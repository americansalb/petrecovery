"""Setup script for Pet Recovery Simulation Engine."""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="petrecovery-simulation",
    version="1.0.0",
    author="Pet Recovery Team",
    description="Monte Carlo simulation engine for lost pet recovery based on behavioral research",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Simulation",
    ],
    python_requires=">=3.9",
    install_requires=[
        # No required dependencies - uses only stdlib
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=3.0.0",
            "black>=22.0.0",
            "mypy>=0.950",
            "flake8>=4.0.0",
        ],
        "api": [
            "fastapi>=0.68.0",
            "uvicorn>=0.15.0",
            "pydantic>=1.8.0",
        ],
        "performance": [
            "numpy>=1.21.0",
            "scipy>=1.7.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "petrecovery-sim=simulation.demo:main",
        ],
    },
)
