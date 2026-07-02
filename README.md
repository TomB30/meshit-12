# סימולטור מבחן משיט 12

אתר סטטי לתרגול מבחן תיאוריה לרישיון משיט סירת מנוע עוצמה א' (משיט 12) בישראל.

## הרצה מקומית

```bash
cd docs
python3 -m http.server 8080
```

פתחו http://localhost:8080

## פריסה ב-GitHub Pages

האתר מתפרסם אוטומטית מתיקיית `docs/` בענף `main`.

1. דחיפת שינויים ל-`main` מפעילה build חדש
2. הכתובת: https://tomb30.github.io/meshit-12/

## מבנה

```
docs/               ← האתר (מה שמפורסם)
  index.html
  css/styles.css
  js/app.js
  data/questions.json
  data/image-map.json
  images/pages/
scripts/parse_pdf.py  ← חילוץ שאלות מה-PDF (לא מפורסם)
```

## עדכון שאלות מה-PDF

```bash
pdftotext "מאגר שאלות משיט 12.pdf" pdf_raw.txt
python3 scripts/parse_pdf.py
# העתק ל-docs:
cp -r data docs/
```

## רף עובר

70% (21 מתוך 30) — ניתן לשנות ב-`docs/js/app.js` (`PASS_THRESHOLD`).
