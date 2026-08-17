# -*- coding: utf-8 -*-
"""
Regenera img/index.json, plantillas/index.json y proyectos/index.json
a partir de lo que exista en cada carpeta. Correr ANTES de "git add" /
"git push" cada vez que agregues, quites o renombres archivos ahi.

Uso:
    python generate_manifests.py
"""
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))

IMG_DIR = os.path.join(BASE, "img")
PLANTILLAS_DIR = os.path.join(BASE, "plantillas")
PROYECTOS_DIR = os.path.join(BASE, "proyectos")

IMG_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"}


def read_text_any_encoding(path):
    """Lee un archivo probando UTF-8 y UTF-16 (los .json que exporta el
    macro de Excel/VBA suelen venir en UTF-16)."""
    with open(path, "rb") as f:
        raw = f.read()
    if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return raw.decode("utf-16")
    for encoding in ("utf-8-sig", "utf-8", "utf-16", "windows-1252"):
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, UnicodeError):
            continue
    return raw.decode("utf-8", errors="replace")


def generate_img_manifest():
    if not os.path.isdir(IMG_DIR):
        print("  (no existe img/, se omite)")
        return
    files = sorted(
        f for f in os.listdir(IMG_DIR)
        if os.path.splitext(f)[1].lower() in IMG_EXTENSIONS
    )
    entries = [{"imageFile": f} for f in files]
    out_path = os.path.join(IMG_DIR, "index.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    print(f"  img/index.json -> {len(entries)} unidades")
    for e in entries:
        print(f"    - {e['imageFile']}")


def generate_plantillas_manifest():
    if not os.path.isdir(PLANTILLAS_DIR):
        print("  (no existe plantillas/, se omite)")
        return
    files = sorted(f for f in os.listdir(PLANTILLAS_DIR) if f.lower().endswith(".json") and f != "index.json")
    entries = []
    for f in files:
        label = os.path.splitext(f)[0]
        try:
            payload = json.loads(read_text_any_encoding(os.path.join(PLANTILLAS_DIR, f)))
            if isinstance(payload, dict) and payload.get("name"):
                label = str(payload["name"]).strip()
        except Exception as error:
            print(f"    AVISO: no se pudo leer el nombre de {f}: {error}")
        entries.append({"file": f, "label": label})
    out_path = os.path.join(PLANTILLAS_DIR, "index.json")
    with open(out_path, "w", encoding="utf-8") as f_out:
        json.dump(entries, f_out, ensure_ascii=False, indent=2)
    print(f"  plantillas/index.json -> {len(entries)} plantillas")
    for e in entries:
        print(f"    - {e['file']}  (\"{e['label']}\")")


def generate_proyectos_manifest():
    if not os.path.isdir(PROYECTOS_DIR):
        print("  (no existe proyectos/, se omite)")
        return
    files = sorted(f for f in os.listdir(PROYECTOS_DIR) if f.lower().endswith(".json") and f != "index.json")
    entries = []
    for f in files:
        label = os.path.splitext(f)[0]
        try:
            payload = json.loads(read_text_any_encoding(os.path.join(PROYECTOS_DIR, f)))
            libro = payload.get("Metadatos", {}).get("LibroOrigen") if isinstance(payload, dict) else None
            if libro:
                label = os.path.splitext(str(libro).strip())[0]
        except Exception as error:
            print(f"    AVISO: no se pudo leer el nombre de {f}: {error}")
        entries.append({"file": f, "label": label})
    out_path = os.path.join(PROYECTOS_DIR, "index.json")
    with open(out_path, "w", encoding="utf-8") as f_out:
        json.dump(entries, f_out, ensure_ascii=False, indent=2)
    print(f"  proyectos/index.json -> {len(entries)} datasets")
    for e in entries:
        print(f"    - {e['file']}  (\"{e['label']}\")")


if __name__ == "__main__":
    print("Generando manifiestos...")
    print("img/:")
    generate_img_manifest()
    print("plantillas/:")
    generate_plantillas_manifest()
    print("proyectos/:")
    generate_proyectos_manifest()
    print("Listo.")
