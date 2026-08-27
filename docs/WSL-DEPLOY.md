# Chạy deploy KNĂ Track 2 trên máy này (WSL + ổ D)

Ổ D **được**. Code nằm ở `D:\Travel\kna-docker`, trong WSL là `/mnt/d/Travel/kna-docker`.

Ubuntu **không** cài trên C (C đã đầy). Distro nằm ở `D:\WSL\Ubuntu-24.04`.

---

## 0. Mở Ubuntu (không dùng PowerShell cho các lệnh dưới)

Start menu → **Ubuntu 24.04**  
hoặc PowerShell:

```powershell
wsl -d Ubuntu-24.04
```

Nếu vào được nhưng lệnh `solana`/`anchor` không thấy, dán:

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
. "$HOME/.cargo/env"
```

Kiểm tra:

```bash
rustc --version     # 1.84.0
solana --version    # 2.1.5
anchor --version    # 0.30.1
```

---

## 1. Nạp SOL cho ví deploy (bắt buộc — CLI đang bị rate-limit)

Ví deploy:

```
FfNVnqMmVPHYBQCaZdHbteBMpc7TReNsTpocHBRz1u6J
```

1. Mở https://faucet.solana.com/
2. Network: **devnet**
3. Dán địa chỉ trên
4. Amount: **2 SOL**
5. Confirm (GitHub login nếu faucet yêu cầu)

Kiểm tra trong Ubuntu:

```bash
solana balance FfNVnqMmVPHYBQCaZdHbteBMpc7TReNsTpocHBRz1u6J --url https://api.devnet.solana.com
```

Cần **≥ 2 SOL** trước khi deploy.

---

## 2. Trỏ CLI vào ví deploy

```bash
solana config set --url https://api.devnet.solana.com \
  --keypair /mnt/d/Travel/kna-docker/secrets/deploy-keypair.json
solana config get
```

---

## 3. Build program (chạy trên Linux FS, đỡ chậm / đỡ OOM hơn `/mnt/d`)

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
. "$HOME/.cargo/env"
export CARGO_BUILD_JOBS=1

mkdir -p /root/kna-build
rsync -a --delete \
  --exclude node_modules --exclude target --exclude .git \
  /mnt/d/Travel/kna-docker/app/ /root/kna-build/

cd /root/kna-build
mkdir -p target/deploy
cp /mnt/d/Travel/kna-docker/secrets/kna-trust-program-keypair.json \
   target/deploy/kna_trust_layer-keypair.json

anchor build --provider.cluster devnet
```

Chờ 5–15 phút. Thành công khi thấy `target/deploy/kna_trust_layer.so`.

---

## 4. Deploy lên devnet

```bash
cd /root/kna-build
anchor deploy --provider.cluster devnet
```

Program ID đã gắn sẵn:

```
2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f
```

Explorer:

https://explorer.solana.com/address/2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f?cluster=devnet

Copy file `.so` về ổ D (để repo có artifact):

```bash
mkdir -p /mnt/d/Travel/kna-docker/app/target/deploy
cp -a /root/kna-build/target/deploy/. /mnt/d/Travel/kna-docker/app/target/deploy/
```

---

## 5. Ghi Program ID vào env

Tạo `D:\Travel\kna-docker\secrets\.env.solana` (copy từ `.env.solana.example`) rồi sửa:

```
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
KNA_TRUST_PROGRAM_ID=2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f
SOLANA_ENABLED=true
CHAIN_WORKER_ENABLED=true
COORDINATOR_KEYPAIR_PATH=./secrets/coordinator-keypair.json
```

`KNA_COMMITTEE_VAULT` để trống đến khi tạo Squads 2-of-3 (xem `docs/SQUADS-SETUP.md`).

---

## 6. Squads (sau khi program đã lên Explorer)

1. https://devnet.squads.so/
2. Members = 3 pubkey Committee trong `secrets/PUBKEYS.txt`
3. Threshold **2 of 3**
4. Copy **Vault** → `KNA_COMMITTEE_VAULT`

---

## 7. Chạy app Docker (Windows PowerShell)

```powershell
cd d:\Travel\kna-docker
docker compose up --build
```

Web: http://localhost:8080  

Bật Solana profile (khi đã có SOL + program trên chain):

```powershell
docker compose -f docker-compose.yml -f docker-compose.solana.yml --profile solana up --build
```

---

## Lệnh một phát (sau khi faucet đã có ≥ 2 SOL)

Trong Ubuntu:

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
. "$HOME/.cargo/env"
export CARGO_BUILD_JOBS=1
bash /mnt/d/Travel/kna-docker/scripts/run-deploy-now.sh
```

Script đó airdrop (thường fail), build, deploy, ghi `.env.solana`.
