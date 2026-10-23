"""Read analysis choices once at the entry point; calculations receive values."""
from dataclasses import dataclass
from math import isfinite
from pathlib import Path
import tomllib


@dataclass(frozen=True)
class AnalysisConfig:
    """Resolved paths and inclusive RT bounds in seconds."""
    data_path: Path
    output_dir: Path
    min_rt_s: float
    max_rt_s: float
    config_path: Path | None = None

    def __post_init__(self):
        bounds = (self.min_rt_s, self.max_rt_s)
        if any(type(value) not in (int, float) or not isfinite(value) for value in bounds):
            raise ValueError("RT bounds must be finite numbers in seconds (not strings or booleans)")
        if not 0 < self.min_rt_s < self.max_rt_s:
            raise ValueError("Require 0 < min_rt_s < max_rt_s")


def _expect_keys(section, expected, label):
    if not isinstance(section, dict):
        raise ValueError(f"{label} must be a TOML table")
    missing = expected - section.keys()
    unknown = section.keys() - expected
    if missing or unknown:
        raise ValueError(f"{label}: missing keys {sorted(missing)}; unknown keys {sorted(unknown)}")


def load_config(path: Path | str) -> AnalysisConfig:
    """Validate required settings and resolve relative paths from the TOML file.

    Reject unknown keys instead of silently ignoring a misspelled scientific
    parameter. No implicit fallback replaces a missing or malformed file.
    """
    config_path = Path(path).resolve()
    with config_path.open("rb") as config_file:
        settings = tomllib.load(config_file)
    _expect_keys(settings, {"paths", "preprocessing"}, "configuration")
    _expect_keys(settings["paths"], {"data", "output"}, "paths")
    _expect_keys(settings["preprocessing"], {"min_rt_s", "max_rt_s"}, "preprocessing")
    paths = settings["paths"]
    for name, value in paths.items():
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"paths.{name} must be a nonempty path string")
    return AnalysisConfig(
        data_path=(config_path.parent / paths["data"]).resolve(),
        output_dir=(config_path.parent / paths["output"]).resolve(),
        min_rt_s=settings["preprocessing"]["min_rt_s"],
        max_rt_s=settings["preprocessing"]["max_rt_s"],
        config_path=config_path,
    )
