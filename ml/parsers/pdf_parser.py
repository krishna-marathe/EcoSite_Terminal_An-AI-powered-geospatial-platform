"""Pure Python PDF text parser with zero external dependencies.

Supports standard text-based PDF 1.0-1.7 documents, FlateDecode streams,
Tj / TJ text operators, and page boundary tracking.
Falls back to pypdf / pdfplumber if installed.
"""

import io
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple, Union
import zlib

from ml.contracts.schemas import ParsedDocument, ParsedPage


def _unescape_pdf_string(s: str) -> str:
    """Unescape standard PDF string literal escapes."""
    s = s.replace(r"\n", "\n").replace(r"\r", "\r").replace(r"\t", "\t")
    s = s.replace(r"\(", "(").replace(r"\)", ")").replace(r"\\", "\\")
    # Octal escapes: \ddd
    def replace_octal(match):
        try:
            return chr(int(match.group(1), 8))
        except ValueError:
            return match.group(0)
    s = re.sub(r"\\([0-7]{1,3})", replace_octal, s)
    return s


def _extract_text_from_pdf_stream(stream_bytes: bytes) -> str:
    """Extract text lines from a decompressed PDF content stream."""
    try:
        content = stream_bytes.decode("latin-1")
    except Exception:
        content = stream_bytes.decode("utf-8", errors="ignore")

    lines: List[str] = []
    current_line_parts: List[str] = []

    # Find text blocks: standalone BT ... ET (require whitespace around operators)
    bt_et_blocks = re.findall(r"(?:^|\s)BT\s+(.*?)\s+ET(?:\s|$)", content, re.DOTALL)

    if not bt_et_blocks:
        # Fallback: scan for any (text) Tj in content directly
        bt_et_blocks = [content]

    for block in bt_et_blocks:
        # Regex to find:
        # 1. (string) Tj or '
        # 2. [ (string1) -123 (string2) ] TJ
        # 3. T* or Td or TD (new lines)
        tokens = re.finditer(r"""
            \((?:[^()\\]|\\.)*\)\s*(?:Tj|')   |  # (text) Tj
            \[(.*?)\]\s*TJ                     |  # [(text) ...] TJ
            (?:T\*|(?:[-+]?\d*\.?\d+\s+){2}T[dD]) # newline operators
        """, block, re.VERBOSE | re.DOTALL)

        for match in tokens:
            token = match.group(0).strip()
            if token.startswith("[") and token.endswith("TJ"):
                # Array of strings & kernings: [(Hello) 12 (world)] TJ
                inner = match.group(1)
                str_matches = re.findall(r"\((?:[^()\\]|\\.)*\)", inner)
                extracted = " ".join(_unescape_pdf_string(m[1:-1]) for m in str_matches)
                if extracted:
                    current_line_parts.append(extracted)
            elif token.endswith("Tj") or token.endswith("'"):
                # Single string: (Hello) Tj
                str_match = re.search(r"\((.*)\)\s*(?:Tj|')", token, re.DOTALL)
                if str_match:
                    raw_str = str_match.group(1)
                    current_line_parts.append(_unescape_pdf_string(raw_str))
                if token.endswith("'"):
                    lines.append(" ".join(current_line_parts).strip())
                    current_line_parts = []
            else:
                # T*, Td, TD newline
                if current_line_parts:
                    lines.append(" ".join(current_line_parts).strip())
                    current_line_parts = []

        if current_line_parts:
            lines.append(" ".join(current_line_parts).strip())
            current_line_parts = []

    clean_lines = [l for l in lines if l]
    return "\n".join(clean_lines)


class PDFParser:
    """Robust PDF text extractor with zero external library requirement."""

    @classmethod
    def parse_bytes(cls, pdf_bytes: bytes, filename: str = "document.pdf", document_id: Optional[str] = None) -> ParsedDocument:
        """Parse PDF byte stream into ParsedDocument."""
        if document_id is None:
            document_id = Path(filename).stem

        # Try pypdf first if available
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            pages = []
            for idx, p in enumerate(reader.pages, start=1):
                txt = p.extract_text() or ""
                pages.append(ParsedPage(page_number=idx, text=txt.strip()))
            if pages:
                return ParsedDocument(
                    document_id=document_id,
                    filename=filename,
                    file_format="PDF",
                    page_count=len(pages),
                    pages=pages,
                    metadata={"engine": "pypdf"}
                )
        except ImportError:
            pass
        except Exception:
            pass

        # Native pure-python PDF extractor with graceful corruption fallback
        try:
            pages = cls._parse_native(pdf_bytes)
        except Exception:
            pages = []

        is_corrupted = False
        error_msg = None
        if not pages:
            # Fallback for plain text or minimal extraction
            try:
                raw_text = cls._extract_raw_strings(pdf_bytes)
            except Exception as e:
                raw_text = ""
                error_msg = str(e)
            if not raw_text.strip():
                is_corrupted = True
                error_msg = error_msg or "No valid PDF page objects or text streams found"
            pages = [ParsedPage(page_number=1, text=raw_text.strip())]

        meta = {"engine": "native_pdf_stream_decoder"}
        if is_corrupted:
            meta["corrupted"] = True
            meta["error"] = error_msg

        return ParsedDocument(
            document_id=document_id,
            filename=filename,
            file_format="PDF",
            page_count=len(pages),
            pages=pages,
            metadata=meta
        )

    @classmethod
    def parse_file(cls, file_path: Union[str, Path], document_id: Optional[str] = None) -> ParsedDocument:
        path = Path(file_path)
        data = path.read_bytes()
        return cls.parse_bytes(data, filename=path.name, document_id=document_id)

    @classmethod
    def _parse_native(cls, pdf_bytes: bytes) -> List[ParsedPage]:
        """Extract pages by finding /Type /Page objects and their /Contents streams."""
        # Find all indirect objects: X Y obj ... endobj
        obj_pattern = re.compile(rb"(\d+)\s+(\d+)\s+obj\r?\n(.*?)\r?\nendobj", re.DOTALL)
        objects: Dict[int, bytes] = {}

        for m in obj_pattern.finditer(pdf_bytes):
            obj_num = int(m.group(1))
            obj_body = m.group(3)
            objects[obj_num] = obj_body

        # Find objects with /Type /Page (excluding /Pages)
        page_indices: List[int] = []
        for obj_num, body in sorted(objects.items()):
            if re.search(rb"/Type\s*/Page\b", body) and not re.search(rb"/Type\s*/Pages\b", body):
                page_indices.append(obj_num)

        parsed_pages: List[ParsedPage] = []
        for page_idx, obj_num in enumerate(page_indices, start=1):
            body = objects[obj_num]
            # Find /Contents ref: /Contents 5 0 R or /Contents [ 5 0 R 6 0 R ]
            contents_match = re.search(rb"/Contents\s+(\d+)\s+\d+\s+R", body)
            page_text_parts = []

            if contents_match:
                stream_obj_num = int(contents_match.group(1))
                if stream_obj_num in objects:
                    stream_body = objects[stream_obj_num]
                    decompressed = cls._extract_stream_data(stream_body)
                    if decompressed:
                        txt = _extract_text_from_pdf_stream(decompressed)
                        if txt:
                            page_text_parts.append(txt)
            else:
                # Check for array of streams: /Contents [ ... ]
                array_match = re.search(rb"/Contents\s*\[(.*?)\]", body, re.DOTALL)
                if array_match:
                    refs = re.findall(rb"(\d+)\s+\d+\s+R", array_match.group(1))
                    for ref_num in refs:
                        stream_obj_num = int(ref_num)
                        if stream_obj_num in objects:
                            decompressed = cls._extract_stream_data(objects[stream_obj_num])
                            if decompressed:
                                txt = _extract_text_from_pdf_stream(decompressed)
                                if txt:
                                    page_text_parts.append(txt)

            page_text = "\n".join(page_text_parts)
            parsed_pages.append(ParsedPage(page_number=page_idx, text=page_text.strip()))

        return parsed_pages

    @classmethod
    def _extract_stream_data(cls, obj_body: bytes) -> Optional[bytes]:
        """Extract stream bytes between 'stream' and 'endstream', decompressing if needed."""
        stream_start = obj_body.find(b"stream\r\n")
        header_len = 8
        if stream_start == -1:
            stream_start = obj_body.find(b"stream\n")
            header_len = 7
        if stream_start == -1:
            return None

        stream_data = obj_body[stream_start + header_len:]
        stream_end = stream_data.rfind(b"\r\nendstream")
        if stream_end == -1:
            stream_end = stream_data.rfind(b"\nendstream")
        if stream_end == -1:
            stream_end = stream_data.rfind(b"endstream")
        if stream_end != -1:
            stream_data = stream_data[:stream_end]

        header = obj_body[:stream_start]
        # Check /Filter /FlateDecode
        if b"/FlateDecode" in header or b"/Fl" in header:
            try:
                return zlib.decompress(stream_data)
            except Exception:
                # Try raw inflate without header
                try:
                    return zlib.decompress(stream_data, -15)
                except Exception:
                    return stream_data
        return stream_data

    @classmethod
    def _extract_raw_strings(cls, pdf_bytes: bytes) -> str:
        """Heuristic string extractor when stream parsing fails."""
        # Find all (string) tokens in the entire file
        matches = re.findall(rb"\((?:[^()\\]|\\.)*\)", pdf_bytes)
        lines = []
        for m in matches:
            try:
                s = m[1:-1].decode("latin-1")
                if len(s.strip()) > 1 and any(c.isalnum() for c in s):
                    lines.append(_unescape_pdf_string(s))
            except Exception:
                pass
        return "\n".join(lines)
