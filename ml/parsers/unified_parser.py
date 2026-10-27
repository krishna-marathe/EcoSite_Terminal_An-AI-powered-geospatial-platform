"""Unified document parser supporting PDF, DOCX, TXT, and Markdown.

Auto-detects format, coordinates specialized parsers, and outputs standardized ParsedDocument.
"""

from pathlib import Path
from typing import Optional, Union

from ml.contracts.schemas import ParsedDocument, ParsedPage
from ml.parsers.docx_parser import DOCXParser
from ml.parsers.pdf_parser import PDFParser


class DocumentParser:
    """Unified entry point for document parsing across supported formats."""

    @classmethod
    def parse_file(cls, file_path: Union[str, Path], document_id: Optional[str] = None) -> ParsedDocument:
        """Parse any supported document file into a structured ParsedDocument."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Document file not found: {path}")

        if document_id is None:
            document_id = path.stem

        ext = path.suffix.lower()
        if ext == ".pdf":
            return PDFParser.parse_file(path, document_id=document_id)
        elif ext in [".docx", ".doc"]:
            return DOCXParser.parse_file(path, document_id=document_id)
        elif ext in [".txt", ".md"]:
            return cls._parse_text_file(path, document_id=document_id)
        else:
            # Fallback attempt: check magic bytes
            raw_bytes = path.read_bytes()
            if raw_bytes.startswith(b"%PDF"):
                return PDFParser.parse_bytes(raw_bytes, filename=path.name, document_id=document_id)
            elif raw_bytes.startswith(b"PK\x03\x04"):
                return DOCXParser.parse_bytes(raw_bytes, filename=path.name, document_id=document_id)
            else:
                return cls._parse_text_bytes(raw_bytes, filename=path.name, document_id=document_id)

    @classmethod
    def parse_bytes(cls, data: bytes, filename: str, document_id: Optional[str] = None) -> ParsedDocument:
        """Parse raw document bytes with filename hint."""
        if document_id is None:
            document_id = Path(filename).stem

        ext = Path(filename).suffix.lower()
        if ext == ".pdf" or data.startswith(b"%PDF"):
            return PDFParser.parse_bytes(data, filename=filename, document_id=document_id)
        elif ext in [".docx", ".doc"] or data.startswith(b"PK\x03\x04"):
            return DOCXParser.parse_bytes(data, filename=filename, document_id=document_id)
        else:
            return cls._parse_text_bytes(data, filename=filename, document_id=document_id)

    @classmethod
    def _parse_text_file(cls, path: Path, document_id: str) -> ParsedDocument:
        raw_text = path.read_text(encoding="utf-8", errors="ignore")
        return cls._create_text_doc(raw_text, filename=path.name, document_id=document_id)

    @classmethod
    def _parse_text_bytes(cls, data: bytes, filename: str, document_id: str) -> ParsedDocument:
        try:
            raw_text = data.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = data.decode("latin-1", errors="ignore")
        return cls._create_text_doc(raw_text, filename=filename, document_id=document_id)

    @classmethod
    def _create_text_doc(cls, raw_text: str, filename: str, document_id: str) -> ParsedDocument:
        # Check for explicit page break markers
        page_splits = raw_text.split("--- [Page Break] ---")
        if len(page_splits) == 1:
            page_splits = raw_text.split("--- PAGE BREAK ---")

        pages = [
            ParsedPage(page_number=idx, text=part.strip())
            for idx, part in enumerate(page_splits, start=1)
            if part.strip()
        ]

        if not pages:
            pages = [ParsedPage(page_number=1, text="")]

        return ParsedDocument(
            document_id=document_id,
            filename=filename,
            file_format="TXT",
            page_count=len(pages),
            pages=pages,
            raw_text=raw_text.strip(),
            metadata={"engine": "plain_text_parser"}
        )
