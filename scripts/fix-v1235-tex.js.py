from pathlib import Path
p=Path('js/exams/online-export.js')
s=p.read_text(encoding='utf-8')
old="`\\\\end{center}',"
assert old in s, 'TeX end-center mismatch not found'
s=s.replace(old,"'\\\\end{center}',",1)
p.write_text(s,encoding='utf-8')
