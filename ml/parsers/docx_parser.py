"""Pure Python DOCX document parser with zero external dependencies.

Parses Microsoft Word (.docx) OpenXML archives via standard zipfile and ElementTree,
extracting text paragraphs, table cells, and page breaks.
"""

import io
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import xml.etree.ElementTree as ET
import zipfile

from ml.contracts.schemas import ParsedDocument, ParsedPage


# OpenXML namespaces
NAMESPACES = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}


class DOCXParser:
    """DOCX parser using standard library zipfile and xml.etree.ElementTree."""

    @classmethod
    def parse_bytes(cls, docx_bytes: bytes, filename: str = "document.docx", document_id: Optional[str] = None) -> ParsedDocument:
        """Parse DOCX byte stream into ParsedDocument."""
        if document_id is None:
            document_id = Path(filename).stem

        try:
            with zipfile.ZipFile(io.BytesIO(docx_bytes), "r") as zf:
                if "word/document.xml" not in zf.namelist():
                    return ParsedDocument(
                        document_id=document_id,
                        filename=filename,
                        file_format="DOCX",
                        page_count=1,
                        pages=[ParsedPage(page_number=1, text="")],
                        metadata={"engine": "native_openxml_parser", "error": "Missing word/document.xml", "corrupted": True}
                    )
                xml_content = zf.read("word/document.xml")
            pages = cls._parse_document_xml(xml_content)
        except Exception as e:
            return ParsedDocument(
                document_id=document_id,
                filename=filename,
                file_format="DOCX",
                page_count=1,
                pages=[ParsedPage(page_number=1, text="")],
                metadata={"engine": "native_openxml_parser", "error": str(e), "corrupted": True}
            )

        return ParsedDocument(
            document_id=document_id,
            filename=filename,
            file_format="DOCX",
            page_count=len(pages),
            pages=pages,
            metadata={"engine": "native_openxml_parser"}
        )

    @classmethod
    def parse_file(cls, file_path: Union[str, Path], document_id: Optional[str] = None) -> ParsedDocument:
        path = Path(file_path)
        data = path.read_bytes()
        return cls.parse_bytes(data, filename=path.name, document_id=document_id)

    @classmethod
    def _parse_document_xml(cls, xml_bytes: bytes) -> List[ParsedPage]:
        """Traverse word/document.xml, splitting paragraphs and tables into pages."""
        root = ET.fromstring(xml_bytes)
        body = root.find("w:body", NAMESPACES)
        if body is None:
            return [ParsedPage(page_number=1, text="")]

        current_page_text: List[str] = []
        current_page_tables: List[List[List[str]]] = []
        pages: List[ParsedPage] = []
        page_num = 1

        for child in body:
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

            if tag == "p":
                # Check for page break in paragraph runs
                has_page_break = False
                for br in child.findall(".//w:br", NAMESPACES):
                    if br.get(f"{{{NAMESPACES['w']}}}type") == "page":
                        has_page_break = True
                        break
                if not has_page_break:
                    if child.findall(".//w:lastRenderedPageBreak", NAMESPACES):
                        has_page_break = True

                # Extract text runs
                p_text_parts = []
                for t in child.findall(".//w:t", NAMESPACES):
                    if t.text:
                        p_text_parts.append(t.text)
                p_text = "".join(p_text_parts).strip()

                if has_page_break and (current_page_text or current_page_tables):
                    pages.append(ParsedPage(
                        page_number=page_num,
                        text="\n".join(current_page_text).strip(),
                        tables=current_page_tables
                    ))
                    page_num += 1
                    current_page_text = []
                    current_page_tables = []

                if p_text:
                    current_page_text.append(p_text)

            elif tag == "tbl":
                # Parse table rows and cells
                table_matrix: List[List[str]] = []
                for tr in child.findall("w:tr", NAMESPACES):
                    row_cells: List[str] = []
                    for tc in tr.findall("w:tc", NAMESPACES):
                        cell_texts = [t.text for t in tc.findall(".//w:t", NAMESPACES) if t.text]
                        row_cells.append(" ".join(cell_texts).strip())
                    table_matrix.append(row_cells)

                if table_matrix:
                    current_page_tables.append(table_matrix)
                    # Also append table rows in text representation
                    for row in table_matrix:
                        current_page_text.append(" | ".join(row))

        # Append last page
        pages.append(ParsedPage(
            page_number=page_num,
            text="\n".join(current_page_text).strip(),
            tables=current_page_tables
        ))

        return pages
