#!/usr/bin/env python3
"""Generate a static photo gallery with justified layout and PhotoSwipe."""

from __future__ import annotations

import argparse
import random
import shutil
import sys
from pathlib import Path
from urllib.parse import quote

from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image, ImageOps
from tqdm import tqdm

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
}

# Keep in sync with static/app.js layoutConfig.targetRowHeight.
TARGET_ROW_HEIGHT = 320
GALLERY_HEIGHT_SCALE = 1.5
LIGHTBOX_MAX_DIMENSION = 3000
GALLERY_AVIF_QUALITY = 75
GALLERY_AVIF_SPEED = 6
LIGHTBOX_AVIF_QUALITY = 85
LIGHTBOX_AVIF_SPEED = 4
DEV_AVIF_QUALITY = 30
DEV_AVIF_SPEED = 10
TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
DEFAULT_FAVICON_EMOJI = "📸"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a static justified photo gallery.",
    )
    parser.add_argument("input_dir", help="Directory of images to include")
    parser.add_argument("output_dir", help="Directory to write the static site")
    parser.add_argument("--header", help="Header text for the page")
    parser.add_argument("--footer", help="Footer attribution text")
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Use fastest image compression for quick iteration",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Only process the first N images (requires --dev)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite output directory if it already exists",
    )
    parser.add_argument(
        "--shuffle",
        action="store_true",
        help="Randomize the order of discovered images",
    )
    parser.add_argument(
        "--download",
        action="store_true",
        help="Include original images and enable the lightbox download button",
    )
    parser.add_argument(
        "--margin",
        type=int,
        default=4,
        help="Justified layout margin size between photos in pixels (default: %(default)s)",
    )
    parser.add_argument(
        "--favicon-emoji",
        default=DEFAULT_FAVICON_EMOJI,
        help="Emoji to embed in the favicon (default: %(default)s)",
    )
    return parser.parse_args()


def discover_images(input_dir: Path) -> list[Path]:
    candidates = [
        path
        for path in input_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    candidates.sort(key=lambda path: path.relative_to(input_dir).as_posix())
    return candidates


def alt_text_from_path(path: Path) -> str:
    raw = path.stem.replace("_", " ").replace("-", " ").strip()
    return raw if raw else "Image"


def ensure_output_dir(output_dir: Path, overwrite: bool) -> None:
    if output_dir.exists():
        if not overwrite:
            raise FileExistsError(
                f"Output directory already exists: {output_dir}. Use --overwrite to replace it."
            )
        for entry in output_dir.iterdir():
            if entry.is_dir():
                shutil.rmtree(entry)
            else:
                entry.unlink()
    output_dir.mkdir(parents=True, exist_ok=True)


def write_text(path: Path, contents: str) -> None:
    path.write_text(contents, encoding="utf-8")


def ensure_avif_mode(image: Image.Image) -> Image.Image:
    if image.mode in ("RGB", "RGBA"):
        return image
    has_alpha = image.mode in ("LA", "RGBA") or (image.mode == "P" and "transparency" in image.info)
    return image.convert("RGBA" if has_alpha else "RGB")


def scaled_size_for_height(
    width: int,
    height: int,
    target_height: int,
) -> tuple[int, int]:
    if height <= target_height:
        return width, height
    scale = target_height / height
    return max(1, round(width * scale)), max(1, round(height * scale))


def scaled_size_for_max_dimension(
    width: int,
    height: int,
    max_dimension: int,
) -> tuple[int, int]:
    largest = max(width, height)
    if largest <= max_dimension:
        return width, height
    scale = max_dimension / largest
    return max(1, round(width * scale)), max(1, round(height * scale))


def save_avif(
    image: Image.Image,
    path: Path,
    *,
    quality: int,
    speed: int,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="AVIF", quality=quality, speed=speed)


def build_template_environment() -> Environment:
    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["urlencode"] = lambda value: quote(str(value), safe="")
    return env


def generate_html(
    title: str,
    header_text: str | None,
    footer_text: str | None,
    items: list[dict[str, str | None]],
    margin: int,
    favicon_emoji: str,
) -> str:
    env = build_template_environment()
    template = env.get_template("page.html")
    return template.render(
        title=title,
        header_text=header_text,
        footer_text=footer_text,
        items=items,
        margin=margin,
        favicon_emoji=favicon_emoji,
    )


def main() -> int:
    args = parse_args()
    input_dir = Path(args.input_dir).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()

    if not input_dir.exists() or not input_dir.is_dir():
        print(f"Input directory not found: {input_dir}", file=sys.stderr)
        return 1

    try:
        ensure_output_dir(output_dir, args.overwrite)
    except FileExistsError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    static_src = Path(__file__).resolve().parent / "static"
    shutil.copytree(static_src, output_dir / "static")

    if args.limit is not None and not args.dev:
        print("--limit requires --dev", file=sys.stderr)
        return 1
    if args.limit is not None and args.limit <= 0:
        print("--limit must be a positive integer", file=sys.stderr)
        return 1
    if args.margin < 0:
        print("--margin must be a non-negative integer", file=sys.stderr)
        return 1

    images = discover_images(input_dir)
    if args.shuffle:
        random.shuffle(images)
    if args.limit is not None:
        images = images[: args.limit]
    if not images:
        print(f"No images found in {input_dir}", file=sys.stderr)
        return 1

    output_gallery_root = output_dir / "gallery"
    output_lightbox_root = output_dir / "lightbox"
    output_original_root = output_dir / "original" if args.download else None
    items: list[dict[str, str | None]] = []
    gallery_target_height = round(TARGET_ROW_HEIGHT * GALLERY_HEIGHT_SCALE)
    if args.dev:
        gallery_quality = DEV_AVIF_QUALITY
        gallery_speed = DEV_AVIF_SPEED
        lightbox_quality = DEV_AVIF_QUALITY
        lightbox_speed = DEV_AVIF_SPEED
    else:
        gallery_quality = GALLERY_AVIF_QUALITY
        gallery_speed = GALLERY_AVIF_SPEED
        lightbox_quality = LIGHTBOX_AVIF_QUALITY
        lightbox_speed = LIGHTBOX_AVIF_SPEED

    for image_path in tqdm(images, desc="Processing images", unit="image"):
        rel_path = image_path.relative_to(input_dir)
        gallery_rel_path = rel_path.with_suffix(".avif")
        lightbox_rel_path = rel_path.with_suffix(".avif")
        original_rel_path = rel_path

        gallery_path = output_gallery_root / gallery_rel_path
        lightbox_path = output_lightbox_root / lightbox_rel_path
        if output_original_root is not None:
            original_path = output_original_root / original_rel_path
            original_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(image_path, original_path)

        with Image.open(image_path) as image:
            image = ImageOps.exif_transpose(image)
            width, height = image.size

            gallery_size = scaled_size_for_height(
                width,
                height,
                gallery_target_height,
            )
            lightbox_size = scaled_size_for_max_dimension(
                width,
                height,
                LIGHTBOX_MAX_DIMENSION,
            )

            gallery_image = image
            if gallery_size != (width, height):
                gallery_image = image.resize(gallery_size, Image.Resampling.LANCZOS)
            gallery_image = ensure_avif_mode(gallery_image)
            save_avif(
                gallery_image,
                gallery_path,
                quality=gallery_quality,
                speed=gallery_speed,
            )

            lightbox_image = image
            if lightbox_size != (width, height):
                lightbox_image = image.resize(lightbox_size, Image.Resampling.LANCZOS)
            lightbox_image = ensure_avif_mode(lightbox_image)
            save_avif(
                lightbox_image,
                lightbox_path,
                quality=lightbox_quality,
                speed=lightbox_speed,
            )

        gallery_width, gallery_height = gallery_size
        lightbox_width, lightbox_height = lightbox_size
        alt = alt_text_from_path(image_path)
        href = quote((Path("lightbox") / lightbox_rel_path).as_posix(), safe="/")
        src = quote((Path("gallery") / gallery_rel_path).as_posix(), safe="/")
        download = None
        if output_original_root is not None:
            download = quote((Path("original") / original_rel_path).as_posix(), safe="/")

        items.append(
            {
                "href": href,
                "src": src,
                "download": download,
                "width": str(gallery_width),
                "height": str(gallery_height),
                "pswp_width": str(lightbox_width),
                "pswp_height": str(lightbox_height),
                "alt": alt,
            }
        )

    page_title = args.header if args.header else "Gallery"
    write_text(
        output_dir / "index.html",
        generate_html(
            page_title,
            args.header,
            args.footer,
            items,
            args.margin,
            args.favicon_emoji,
        ),
    )

    print(f"Wrote gallery to {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
