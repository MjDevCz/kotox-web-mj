# Nextjs Starter steps

> This project uses **yarn** only — never run `npm install`. See
> [docs/dependency-management.md](docs/dependency-management.md) for why.

Local first time:
1) At the very first run: `yarn install`

Local any dev session:
1) Run: `rm -rf .next && yarn dev` which will clear the cache and start pages locally. It will automatically update any changes. Just reload page to see it.


Remote server (e.g. rosti) first time
1) Ensure you have enough memory on the machine for first build (eventually temporarily increase)
2) `yarn install --frozen-lockfile`
3) Image Optimization uses the `sharp` package, which is already a pinned dependency — `yarn install` pulls it in automatically, no extra step needed.
4) `yarn build`

Remote server any update
1) `yarn build`
2) `supervisorctl restart app`  (rosti.cz specific command to restart the app)


General
1) `yarn next -v` checks out version of nextjs. It should be at least 12 for our case.


# NODE Basics
Brew Mac M1
https://stackoverflow.com/questions/64963370/error-cannot-install-in-homebrew-on-arm-processor-in-intel-default-prefix-usr
Before installing Brew
1) type `/usr/sbin/softwareupdate --install-rosetta --agree-to-license`
2) install Homebrew for ARM M1 chip:  `arch -x86_64 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"`
3) Once Homebrew for M1 ARM is installed use this Homebrew command to install packages: `arch -x86_64 brew install <package>`
4) install node to the latest `npm install npm@latest -g`


# Notes
When we see this on Rosti: `info  - Linting and checking validity of types .Killed` it means we have low-end package (low memory). Update the package and it will work fine.

