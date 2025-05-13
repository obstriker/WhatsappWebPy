
# Install node
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install node --reinstall-packages-from=node
nvm alias default node

# install npm libraries
cd whatsapp_client/
npm install
npm install puppeteer --save

sudo apt update && sudo apt install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxcomposite1 \
  libxdamage1 libxrandr2 libxkbcommon0 libgbm1 libxshmfence1 libasound2 \
  libpangocairo-1.0-0 libpangoft2-1.0-0 libgtk-3-0 libdrm2
