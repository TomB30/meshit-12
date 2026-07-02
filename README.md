# סימולטור מבחן משיט 12

אתר סטטי לתרגול מבחן תיאוריה לרישיון משיט סירת מנוע עוצמה א' (משיט 12) בישראל.

## תכונות

- מבחן של 30 שאלות אקראיות בכל פעם
- ערבוב סדר התשובות בכל שאלה
- שמירת כל המבחנים ב-localStorage
- צפייה בתוצאות ובמבחנים קודמים
- תמיכה בשאלות עם תמונות (מעמודי המאגר)

## הרצה מקומית

```bash
# Python
python3 -m http.server 8080

# או npx
npx serve .
```

פתחו http://localhost:8080

## פריסה ב-GitHub Pages

1. צרו repository ב-GitHub והעלו את הקבצים
2. Settings → Pages → Source: **Deploy from a branch**
3. Branch: **main** / folder: **/ (root)**
4. האתר יהיה זמין ב-`https://<username>.github.io/<repo>/`

## מבנה

```
index.html          # דף ראשי
css/styles.css      # עיצוב
js/app.js           # לוגיקת המבחן
data/
  questions.json    # 293+ שאלות עם תשובות
  image-map.json    # מיפוי תמונות לעמודים
images/pages/       # תמונות עמודים מה-PDF
scripts/parse_pdf.py # סקריפט לחילוץ שאלות מה-PDF
```

## עדכון שאלות מה-PDF

```bash
pdftotext "מאגר שאלות משיט 12.pdf" pdf_raw.txt
python3 scripts/parse_pdf.py
```

## רף עובר

70% (21 מתוך 30 תשובות נכונות) — ניתן לשנות ב-`js/app.js` (`PASS_THRESHOLD`).
