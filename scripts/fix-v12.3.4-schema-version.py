from pathlib import Path
p=Path('js/assessment.js')
s=p.read_text(encoding='utf-8').replace('const VERSION = "12.3.4";','const VERSION = "12.3.1";',1)
p.write_text(s,encoding='utf-8')
