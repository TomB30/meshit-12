#!/usr/bin/env python3
"""Parse meshit 12 questions PDF text into questions.json"""
import re
import json
import sys
from pathlib import Path

HEADER_MARKERS = (
    "STATE OF ISRAEL",
    "MINISTRY OF TRANSPORT",
    "מדינת ישראל",
    "משרד התחבורה",
    "התשתיות הלאומיות",
    "רשות הספנות",
    "ADMINISTRATION OF SHIPPING",
    "NATIONAL INFRASTRUCTURES",
    "מבחן למשיט",
)


def clean_text(s: str) -> str:
    s = re.sub(r"[\u200e\u200f\u202a-\u202e\ufeff\u2066-\u2069\u202c\u202d\u202e]", "", s)
    return s.strip()


def is_header(line: str) -> bool:
    return any(m in line for m in HEADER_MARKERS)


def parse_option(line: str):
    m = re.match(r"^([א-ד])(?:\s*\.\s*|\s+)(.+)$", line)
    if m:
        return m.group(1), m.group(2).strip()
    m = re.match(r"^([א-ד])([A-Z])\.?$", line)
    if m:
        return m.group(1), m.group(2)
    return None


def parse_question_header(line: str):
    m = re.match(r"^\.+(\d+)$", line)
    if m:
        return int(m.group(1)), ""
    m = re.match(r"^\.+(\d+)(.+)$", line)
    if m:
        return int(m.group(1)), m.group(2).strip()
    m = re.match(r"^(\d{1,3})$", line)
    if m:
        return int(m.group(1)), ""
    m = re.match(r"^(\d{1,3})([\u0590-\u05FF].+)$", line)
    if m:
        return int(m.group(1)), m.group(2).strip()
    m = re.match(r"^.+\.(\d+)\s*(.+)$", line)
    if m:
        return int(m.group(1)), m.group(2).strip()
    return None


def find_answer_section_start(lines):
    for i in range(len(lines) - 35):
        if lines[i] == "1" and lines[i + 1] == "2" and lines[i + 30] == "31":
            j = i + 31
            while j < len(lines) and not lines[j]:
                j += 1
            if j < len(lines) and lines[j] in "אבגד":
                return i
    return None


def parse_answers(lines):
    answers = {}
    start = find_answer_section_start(lines)
    if start is None:
        raise RuntimeError("Could not locate answer section")

    i = start
    while i < len(lines):
        line = lines[i]
        if line == "תשובות":
            break
        if is_header(line) or not line:
            i += 1
            continue

        if re.fullmatch(r"\d+", line):
            nums = []
            while i < len(lines) and re.fullmatch(r"\d+", lines[i]):
                n = int(lines[i])
                if 1 <= n <= 315:
                    nums.append(n)
                i += 1
            while i < len(lines) and not lines[i]:
                i += 1
            letters = []
            while i < len(lines):
                l = lines[i]
                if l in "אבגד" and len(l) == 1:
                    letters.append(l)
                    i += 1
                elif is_header(l) or not l:
                    i += 1
                elif l == "תשובות":
                    break
                elif re.fullmatch(r"\d+", l):
                    break
                else:
                    i += 1
            if len(nums) == len(letters):
                for n, letter in zip(nums, letters):
                    answers[n] = letter
            continue
        i += 1

    in_answers = False
    for line in lines:
        if line == "תשובות":
            in_answers = True
            continue
        if not in_answers or not line or is_header(line):
            continue
        for num, letter in re.findall(r"(\d+)\s*([א-ד])", line):
            answers[int(num)] = letter

    return answers


def looks_like_question_text(line: str) -> bool:
    if parse_option(line) or parse_question_header(line) or is_header(line):
        return False
    if len(line) < 8:
        return False
    return bool(re.search(r"[\u0590-\u05FF]", line))


def parse_questions(lines, answer_start):
    questions = {}
    order = []
    current_id = None
    awaiting_text = False
    pending_header_id = None
    end = answer_start if answer_start else len(lines)

    def ensure_question(qid):
        nonlocal current_id, pending_header_id
        if qid not in questions:
            questions[qid] = {"id": qid, "text": "", "options": {}}
            order.append(qid)
        current_id = qid
        pending_header_id = None

    def last_incomplete_id():
        for qid in reversed(order):
            if len(questions[qid]["options"]) < 4:
                return qid
        return None

    def next_open_id():
        for qid in range(1, 316):
            if qid not in questions or not questions[qid]["text"] or len(questions[qid]["options"]) < 4:
                return qid
        return None

    i = 0
    while i < end:
        line = lines[i]
        if is_header(line) or not line:
            i += 1
            continue

        opt = parse_option(line)
        if opt:
            key, text = opt
            target = last_incomplete_id()
            if target is None:
                target = current_id or pending_header_id
            if target is None:
                i += 1
                continue
            ensure_question(target)
            questions[target]["options"][key] = text
            i += 1
            continue

        header = parse_question_header(line)
        if header:
            qnum, qtext = header
            if 1 <= qnum <= 315:
                incomplete = last_incomplete_id()
                if not qtext and incomplete is not None and incomplete != qnum:
                    pending_header_id = qnum
                    i += 1
                    continue

                ensure_question(qnum)
                if qtext:
                    if questions[qnum]["text"]:
                        questions[qnum]["text"] = f"{questions[qnum]['text']} {qtext}".strip()
                    else:
                        questions[qnum]["text"] = qtext
                    awaiting_text = False
                else:
                    awaiting_text = True
            i += 1
            continue

        if looks_like_question_text(line):
            target = None
            if awaiting_text and current_id is not None:
                target = current_id
            elif pending_header_id is not None:
                target = pending_header_id
            elif last_incomplete_id() is None:
                target = next_open_id()

            if target is not None:
                ensure_question(target)
                if questions[target]["text"]:
                    questions[target]["text"] = f"{questions[target]['text']} {line}".strip()
                else:
                    questions[target]["text"] = line
                awaiting_text = False
            i += 1
            continue

        i += 1

    return {qid: q for qid, q in questions.items() if len(q["options"]) >= 2 and q["text"]}


def extract_image_refs(q):
    refs = re.findall(r"תמונה[^0-9]*(\d+)", q["text"])
    for opt in q["options"].values():
        refs.extend(re.findall(r"תמונה[^0-9]*(\d+)", opt))
    return list(dict.fromkeys(refs))


def main():
    raw_path = Path(__file__).parent.parent / "pdf_raw.txt"
    out_path = Path(__file__).parent.parent / "data" / "questions.json"

    lines = [clean_text(l) for l in raw_path.read_text(encoding="utf-8").splitlines()]
    answer_start = find_answer_section_start(lines)
    answers = parse_answers(lines)
    questions = parse_questions(lines, answer_start)

    missing_answers = [i for i in range(1, 316) if i not in answers]
    missing_questions = [i for i in range(1, 316) if i not in questions]

    if missing_answers:
        print(f"WARNING: missing answers for {missing_answers}", file=sys.stderr)
    if missing_questions:
        print(f"WARNING: missing questions for {missing_questions}", file=sys.stderr)

    result = []
    for qid in range(1, 316):
        if qid not in questions:
            continue
        q = questions[qid]
        q["correct"] = answers.get(qid)
        q["imageRefs"] = extract_image_refs(q)
        if len(q["options"]) != 4:
            print(f"WARNING: Q{qid} has {len(q['options'])} options: {sorted(q['options'])}", file=sys.stderr)
        result.append(q)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(result)} questions to {out_path}")


if __name__ == "__main__":
    main()
