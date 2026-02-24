"""
Conftest for Next.js e2e tests — standalone, no port-8787 server needed.
"""

def pytest_addoption(parser):
    parser.addoption(
        "--run-network",
        action="store_true",
        default=False,
        help="Run tests marked with @pytest.mark.network",
    )

def pytest_collection_modifyitems(config, items):
    if not config.getoption("--run-network"):
        skip = __import__("pytest").mark.skip(reason="Skipped by default — pass --run-network")
        for item in items:
            if "network" in item.keywords:
                item.add_marker(skip)
