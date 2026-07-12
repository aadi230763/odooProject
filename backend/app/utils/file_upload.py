import os
import uuid

from flask import current_app
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "pdf", "doc", "docx"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_upload(file: FileStorage, subfolder: str = "") -> str:
    """Saves a FileStorage object to the UPLOAD_FOLDER and returns the relative path."""
    if not file or not file.filename:
        raise ValueError("No file provided")

    if not allowed_file(file.filename):
        raise ValueError("File type not allowed")

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    if subfolder:
        upload_folder = os.path.join(upload_folder, subfolder)

    os.makedirs(upload_folder, exist_ok=True)

    filename = secure_filename(file.filename)
    # Prefix with a UUID to prevent collisions
    unique_filename = f"{uuid.uuid4().hex}_{filename}"
    filepath = os.path.join(upload_folder, unique_filename)

    file.save(filepath)

    # Return the path relative to the static folder, e.g. "uploads/assets/..."
    if subfolder:
        return f"uploads/{subfolder}/{unique_filename}"
    return f"uploads/{unique_filename}"
