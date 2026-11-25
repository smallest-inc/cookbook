"""Every file shipped under web/static/models is listed in ASSETS.md with a license, and the
3D asset weight stays inside the budget agreed for v4 (15 MB)."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "web" / "static" / "models"
ASSETS = (ROOT / "ASSETS.md").read_text()
SHIPPED = [p for p in MODELS.rglob("*") if p.is_file() and p.suffix in {".glb", ".gltf", ".jpg", ".png", ".hdr", ".ktx2"}]


def test_every_model_and_texture_is_listed():
    assert SHIPPED, "no 3D assets found"
    missing = [p.name for p in SHIPPED if p.name not in ASSETS]
    assert not missing, f"not in ASSETS.md: {missing}"


def test_every_listed_row_names_a_license():
    for line in ASSETS.splitlines():
        if line.startswith("|") and (".glb" in line or ".jpg" in line):
            assert "CC0" in line or "Original" in line, line


def test_no_game_assets_or_marks():
    names = " ".join(p.name.lower() for p in SHIPPED)
    for word in ("rockstar", "gta", "vice", "leonida_logo"):
        assert word not in names


def test_weight_under_budget():
    total = sum(p.stat().st_size for p in MODELS.rglob("*") if p.is_file())
    assert total < 15 * 1024 * 1024, total


def test_licenses_kept_next_to_models():
    lic = MODELS / "licenses"
    assert (lic / "CC0-1.0.txt").is_file()
    for pack in ("quaternius-cars", "quaternius-ultimate-modular-men", "kenney-car-kit", "kenney-watercraft-kit"):
        assert (lic / f"{pack}.pack.json").is_file(), pack
