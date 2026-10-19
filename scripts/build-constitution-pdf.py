"""Build the branded public Constitution PDF from the approved DOCX source."""
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'frontend' / 'public' / 'media' / 'AIPAF_Constitution.docx'
OUTPUT = ROOT / 'frontend' / 'public' / 'media' / 'AIPAF_Constitution.pdf'
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
PAGE_W, PAGE_H = 595, 842
GREEN = (0.02, 0.25, 0.12)
DARK = (0.035, 0.11, 0.07)
GOLD = (0.82, 0.52, 0.02)
INK = (0.12, 0.16, 0.14)
MUTED = (0.35, 0.40, 0.37)


def extract_paragraphs():
    with ZipFile(SOURCE) as docx:
        root = ElementTree.fromstring(docx.read('word/document.xml'))
    result = []
    for paragraph in root.findall('.//w:body/w:p', NS):
        text = ''.join(node.text or '' for node in paragraph.findall('.//w:t', NS)).strip()
        if not text:
            continue
        style_node = paragraph.find('w:pPr/w:pStyle', NS)
        style = style_node.get('{%s}val' % NS['w']) if style_node is not None else 'Normal'
        text = re.sub(r'^(\d+(?:\.\d+)*)(?=[A-Z(])', r'\1 ', text)
        text = re.sub(r'^(\([a-z]\))(?=[A-Za-z])', r'\1 ', text)
        result.append((style, text))
    return result


def pdf_text(value):
    raw = value.encode('cp1252', errors='replace')
    return '<' + raw.hex().upper() + '>'


def color(rgb):
    return ' '.join(f'{v:.3f}' for v in rgb)


def add_text(ops, x, y, value, size=10, font='F1', rgb=INK):
    ops.append(f"BT /{font} {size} Tf {color(rgb)} rg 1 0 0 1 {x:.1f} {y:.1f} Tm {pdf_text(value)} Tj ET")


def wrap(value, size, max_width):
    words = value.split()
    lines, line = [], ''
    # Conservative Helvetica width estimate; avoids clipping on the right margin.
    capacity = max(22, int(max_width / (size * 0.49)))
    for word in words:
        if len(word) > capacity:
            if line:
                lines.append(line)
                line = ''
            while len(word) > capacity:
                lines.append(word[:capacity])
                word = word[capacity:]
        candidate = (line + ' ' + word).strip()
        if len(candidate) > capacity and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def make_pages(paragraphs):
    pages = []
    # Distinctive cover with the Institute's green and gold identity.
    cover = [
        f"{color(DARK)} rg 0 0 {PAGE_W} {PAGE_H} re f",
        f"{color(GREEN)} rg 0 0 {PAGE_W} 28 re f",
        f"{color(GOLD)} rg 52 612 5 132 re f",
        f"{color(GOLD)} rg 52 612 150 3 re f",
        f"{color((1, 1, 1))} rg 423 650 104 104 re f",
    ]
    # A compact vector rendering of the Institute's plumb-line seal.
    cx, cy, radius = 475, 702, 39
    k = radius * 0.552285
    cover.extend([
        f"{color(GREEN)} RG 2 w {cx + radius} {cy} m {cx + radius} {cy + k:.2f} {cx + k:.2f} {cy + radius} {cx} {cy + radius} c {cx - k:.2f} {cy + radius} {cx - radius} {cy + k:.2f} {cx - radius} {cy} c {cx - radius} {cy - k:.2f} {cx - k:.2f} {cy - radius} {cx} {cy - radius} c {cx + k:.2f} {cy - radius} {cx + radius} {cy - k:.2f} {cx + radius} {cy} c S",
        f"{color(GREEN)} RG 0.8 w {cx + 33} {cy} m {cx + 33} {cy + 18.2} {cx + 18.2} {cy + 33} {cx} {cy + 33} c {cx - 18.2} {cy + 33} {cx - 33} {cy + 18.2} {cx - 33} {cy} c {cx - 33} {cy - 18.2} {cx - 18.2} {cy - 33} {cx} {cy - 33} c {cx + 18.2} {cy - 33} {cx + 33} {cy - 18.2} {cx + 33} {cy} c S",
        f"{color(GREEN)} RG 1 w 475 730 m 475 695 l S 451 711 m 499 711 l S",
        f"{color(GREEN)} rg 457 711 2.2 7 re f 463 711 2.2 5 re f 485 711 2.2 5 re f 491 711 2.2 7 re f",
        f"{color(GOLD)} rg 472 695 m 478 695 l 483 687 l 475 665 l 467 687 l h f",
    ])
    add_text(cover, 76, 724, 'AFRICAN INSTITUTE OF', 11, 'F2', (1, 1, 1))
    add_text(cover, 76, 702, 'PROJECT ASSURANCE AND FORENSICS', 11, 'F2', (1, 1, 1))
    add_text(cover, 76, 653, 'AIPAF', 37, 'F2', (1, 1, 1))
    add_text(cover, 76, 560, 'CONSTITUTION', 29, 'F2', (1, 1, 1))
    add_text(cover, 77, 526, 'THE GOVERNING INSTRUMENT OF THE INSTITUTE', 10, 'F2', (0.96, 0.75, 0.32))
    add_text(cover, 77, 476, 'Adopted for incorporation as a company limited by guarantee', 10, 'F1', (1, 1, 1))
    add_text(cover, 77, 458, 'under the Companies Act, 2019 (Act 992) of the Republic of Ghana', 10, 'F1', (1, 1, 1))
    add_text(cover, 77, 388, 'EDITION 2026', 10, 'F2', (0.96, 0.75, 0.32))
    cover.append(f"{color(GOLD)} rg 77 111 72 2 re f")
    add_text(cover, 77, 84, 'A PAN-AFRICAN PROFESSIONAL BODY', 9, 'F2', (1, 1, 1))
    pages.append(cover)

    body = [(style, text) for style, text in paragraphs if text != 'Contents' and not re.match(r'^(Preamble\d+|Part [A-F].*\d+|Article \d+.*\d+)$', text)]
    toc_items = [(style, text) for style, text in body if style in ('Heading1', 'Heading2')]
    toc = []
    pages.append(toc)
    toc_pages = {}

    current = []
    y = 758
    def start_page():
        nonlocal current, y
        current = [f"{color(GREEN)} rg 58 790 479 1 re f"]
        add_text(current, 58, 804, 'AIPAF  /  CONSTITUTION', 8, 'F2', GREEN)
        y = 758
    def finish_page():
        nonlocal current
        if current:
            current.append(f"{color(GOLD)} rg 58 45 479 0.8 re f")
            pages.append(current)
            current = []
    start_page()
    for style, text in body:
        if style == 'Heading1' and y < 720:
            finish_page()
            start_page()
        if style == 'Heading1':
            toc_pages[(style, text)] = len(pages) + 1
            lines = wrap(text.replace('  |  ', '  /  '), 21, 470)
            if y < 95 + len(lines) * 28:
                finish_page(); start_page()
            for line in lines:
                add_text(current, 58, y, line, 21, 'F2', GREEN)
                y -= 27
            y -= 13
            continue
        if style == 'Heading2':
            toc_pages[(style, text)] = len(pages) + 1
            lines = wrap(text.replace('  |  ', '  /  '), 13, 460)
            if y < 90 + len(lines) * 18:
                finish_page(); start_page()
            for line in lines:
                add_text(current, 58, y, line, 13, 'F2', DARK)
                y -= 18
            y -= 3
            continue
        lines = wrap(text, 9.4, 465)
        if y < 62 + len(lines) * 13:
            finish_page(); start_page()
        for line in lines:
            add_text(current, 63, y, line, 9.4, 'F1', INK)
            y -= 13
        y -= 5
    finish_page()

    add_text(toc, 62, 770, 'CONTENTS', 22, 'F2', GREEN)
    toc.append(f"{color(GOLD)} rg 62 756 470 2 re f")
    y = 732
    for style, text in toc_items:
        indent = 18 if style == 'Heading2' else 0
        size = 8.5 if style == 'Heading2' else 9.5
        title = text.replace('  |  ', '  /  ')
        add_text(toc, 64 + indent, y, title, size, 'F1' if style == 'Heading2' else 'F2', MUTED if style == 'Heading2' else GREEN)
        add_text(toc, 520, y, str(toc_pages.get((style, text), '')), size, 'F1', MUTED)
        y -= 14

    # Stamp sequential page numbers on all interior pages.
    for number, ops in enumerate(pages[1:], start=2):
        add_text(ops, 500, 27, str(number), 8, 'F1', MUTED)
    return pages


def write_pdf(pages):
    objects = [None]
    def obj(value):
        objects.append(value.encode('latin1') if isinstance(value, str) else value)
        return len(objects) - 1

    catalog_id = obj(b'')
    pages_id = obj(b'')
    font_regular = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    font_bold = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
    page_ids = []
    for operations in pages:
        stream = ('\n'.join(operations)).encode('latin1')
        content_id = obj(f'<< /Length {len(stream)} >>\nstream\n'.encode('ascii') + stream + b'\nendstream')
        page_id = obj(f'<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] /Resources << /Font << /F1 {font_regular} 0 R /F2 {font_bold} 0 R >> >> /Contents {content_id} 0 R >>')
        page_ids.append(page_id)
    objects[catalog_id] = f'<< /Type /Catalog /Pages {pages_id} 0 R >>'.encode('ascii')
    objects[pages_id] = f'<< /Type /Pages /Kids [{" ".join(f"{pid} 0 R" for pid in page_ids)}] /Count {len(page_ids)} >>'.encode('ascii')

    data = bytearray(b'%PDF-1.4\n% AIPAF Constitution\n')
    offsets = [0]
    for index, value in enumerate(objects[1:], start=1):
        offsets.append(len(data))
        data.extend(f'{index} 0 obj\n'.encode('ascii'))
        data.extend(value)
        data.extend(b'\nendobj\n')
    xref = len(data)
    data.extend(f'xref\n0 {len(objects)}\n0000000000 65535 f \n'.encode('ascii'))
    for offset in offsets[1:]:
        data.extend(f'{offset:010d} 00000 n \n'.encode('ascii'))
    data.extend(f'trailer\n<< /Size {len(objects)} /Root {catalog_id} 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode('ascii'))
    OUTPUT.write_bytes(data)
    print(f'Wrote {OUTPUT} ({len(pages)} pages, {len(data)} bytes)')


if __name__ == '__main__':
    write_pdf(make_pages(extract_paragraphs()))
