"""Embed the maintained engine and UI in one classic, offline script."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
v=root/"viz"
core=(root/"src/core.js").read_text(encoding="utf-8").split("if(typeof module")[0]
service=(root/"src/service.js").read_text(encoding="utf-8")
association=service[service.index("function frame("):service.index("function lifetime(")]
cfg=(root/"configs/default.yaml").read_text(encoding="utf-8")
script="const DEFAULTS="+cfg+";\n"+core+association+(v/"app.js").read_text(encoding="utf-8")
(v/"simulator.html").write_text((v/"interface.html").read_text(encoding="utf-8").replace("/*__ENGINE__*/",script),encoding="utf-8",newline="\n")

