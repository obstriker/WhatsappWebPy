from setuptools import setup, find_packages

setup(
    name="whatsapp_client",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "fastapi",
        "uvicorn",
        "requests"
    ],
    entry_points={
        "console_scripts": [
            "whatsapp-bot = whatsapp_client.__main__:main"
        ]
    },
    package_data={
        "whatsapp_client": ["node_server.js"]
    },
    author="Your Name",
    description="A FastAPI + WhatsApp Web.js bridge for automated bots",
    python_requires=">=3.8"
)
