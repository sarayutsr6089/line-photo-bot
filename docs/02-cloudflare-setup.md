# ขั้นที่ 2 — ตั้งค่า Cloudflare และ deploy

ใช้เวลาประมาณ 25 นาที ทำผ่านเว็บทั้งหมด ไม่ต้องลงโปรแกรมอะไรบนเครื่อง

> หน้าตาเมนูของ Cloudflare เปลี่ยนเป็นระยะ ถ้าหาปุ่มตามชื่อไม่เจอเป๊ะ ๆ ให้มองหาคำใกล้เคียงในหน้าเดียวกัน หลักการยังเหมือนเดิม

## 2.1 สมัคร Cloudflare

1. เข้า https://dash.cloudflare.com/sign-up สมัครด้วยอีเมล
2. ยืนยันอีเมล — **ไม่ต้องใส่บัตรเครดิต** และไม่ต้องซื้อโดเมน
3. ถ้าถามให้เพิ่มเว็บไซต์ ให้ข้ามไปก่อนได้

## 2.2 สร้างที่เก็บรูป (KV)

1. เมนูซ้าย → **Storage & Databases** → **KV**
2. กด **Create a namespace** (หรือ Create Instance)
3. ตั้งชื่อว่า `line-photo-bot-photos` แล้วกดสร้าง
4. **คัดลอก Namespace ID** ที่ได้ (สตริงตัวอักษรกับตัวเลขยาว ๆ) เก็บไว้ ต้องใช้ข้อถัดไป

## 2.3 ใส่ Namespace ID ลงในโค้ด

1. เปิด repo นี้บน GitHub → กดเข้าไฟล์ `wrangler.toml`
2. กดไอคอนดินสอ (Edit)
3. หาบรรทัด

   ```
   id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"
   ```

   แทนที่ข้อความข้างในเครื่องหมายคำพูด ด้วย Namespace ID จากข้อ 2.2

4. กด **Commit changes**

## 2.4 เชื่อม GitHub กับ Cloudflare แล้ว deploy

1. ใน Cloudflare → เมนูซ้าย **Compute (Workers)** → **Workers & Pages**
2. กด **Create** → เลือกแท็บ **Workers** → มองหาปุ่มที่พูดถึงการเชื่อม Git เช่น **Import a repository**
3. อนุญาตให้ Cloudflare เข้าถึง GitHub แล้วเลือก repo `line-photo-bot`
4. ตั้งค่า build
   - **Branch** — `main`
   - **Build command** — เว้นว่างไว้ (โปรเจกต์นี้ไม่ต้อง build)
   - **Deploy command** — `npx wrangler deploy`
5. กด deploy รอสักครู่
6. เสร็จแล้วจะได้ URL หน้าตาแบบ `https://line-photo-bot.ชื่อบัญชีคุณ.workers.dev` — **คัดลอกเก็บไว้** เรียก URL นี้ว่า **URL ของ Worker**

> **ทางเลือก ถ้าเชื่อม Git ไม่ผ่าน:** repo นี้มี `.github/workflows/deploy.yml` ให้อยู่แล้ว แค่ไปที่ Cloudflare → My Profile → API Tokens → สร้าง token แบบ **Edit Cloudflare Workers** แล้วเอาไปใส่ใน GitHub → repo Settings → Secrets and variables → Actions → New repository secret ชื่อ `CLOUDFLARE_API_TOKEN` จากนั้นทุก push ขึ้น main จะ deploy ให้เอง

## 2.5 ใส่ค่าลับทั้ง 4 ตัว

ค่าพวกนี้ **ห้ามใส่ในไฟล์** เพราะไฟล์อยู่บน GitHub ต้องใส่ผ่านหน้าเว็บ Cloudflare เท่านั้น

1. ใน Cloudflare → **Workers & Pages** → กดเข้า Worker `line-photo-bot`
2. แท็บ **Settings** → **Variables and Secrets** (บางที่เรียก Environment variables)
3. กด **Add** แล้วเลือกชนิดเป็น **Secret** (แบบเข้ารหัส ไม่ใช่ Text) ทีละตัว

   | ชื่อ | ค่าที่ใส่ |
   |---|---|
   | `LINE_CHANNEL_ACCESS_TOKEN` | token ยาว ๆ จากขั้นที่ 1.2 |
   | `LINE_CHANNEL_SECRET` | secret จากขั้นที่ 1.3 |
   | `INGEST_SECRET` | รหัสที่ตั้งเอง ดูวิธีตั้งด้านล่าง |
   | `LINE_TARGET_IDS` | ใส่ค่าว่าง `-` ไปก่อน เดี๋ยวข้อ 2.7 ค่อยกลับมาแก้ |

4. กด **Deploy** / **Save** เพื่อให้ค่ามีผล

### วิธีตั้ง INGEST_SECRET

เป็นรหัสผ่านที่มีแค่ Shortcut ของเรากับ Worker รู้ คนอื่นจะได้ยิงรูปเข้าบอทเราไม่ได้
ให้สุ่มยาว ๆ อย่างน้อย 30 ตัวอักษร ผสมตัวเลขตัวอักษร เช่น

```
kOm3wanRuk7Lookmai2569xQzVbn8Tp
```

**อย่าใช้ค่าตัวอย่างข้างบนจริง ๆ** ให้เปลี่ยนตัวอักษรเองมั่ว ๆ แล้วจดไว้ในโน้ตส่วนตัว เดี๋ยวขั้นที่ 3 ต้องใช้

## 2.6 เช็คว่า Worker ทำงานแล้ว

เปิดเบราว์เซอร์ไปที่ **URL ของ Worker** ควรเห็นข้อความประมาณนี้

```json
{
  "ok": true,
  "service": "line-photo-bot",
  "config": {
    "hasAccessToken": true,
    "hasChannelSecret": true,
    "hasIngestSecret": true,
    "targetCount": 0
  }
}
```

ถ้าตัวไหนเป็น `false` แปลว่ายังใส่ secret ตัวนั้นไม่ครบ ให้กลับไปข้อ 2.5

## 2.7 หา LINE id ของปลายทาง (กลับมาทำต่อจากขั้นที่ 1.6)

1. กลับไป https://developers.line.biz/console/ → channel ของเรา → แท็บ **Messaging API**
2. หัวข้อ **Webhook settings** → **Webhook URL** → กด Edit แล้วใส่

   ```
   URL ของ Worker + /webhook
   ```

   เช่น `https://line-photo-bot.arm.workers.dev/webhook`

3. กด **Update** แล้วกด **Verify** — ควรขึ้น Success
4. เปิด **Use webhook** ให้เป็นเปิด
5. ทีนี้ **ให้ทุกคนที่จะรับรูป พิมพ์ทักบอทมาคนละ 1 ข้อความ** (พิมพ์อะไรก็ได้ เช่น "หวัดดี") และ **พิมพ์อะไรสักอย่างในกลุ่ม LINE ที่เชิญบอทเข้าไป** ด้วย
6. เปิดเบราว์เซอร์ไปที่

   ```
   URL ของ Worker + /ids?key= + INGEST_SECRET ของเรา
   ```

   เช่น `https://line-photo-bot.arm.workers.dev/ids?key=kOm3wanRuk7...`

7. จะเห็นรายการแบบนี้

   ```json
   {
     "sources": [
       { "id": "U4af4980629...", "type": "user" },
       { "id": "Ca56a3f7b91...", "type": "group" }
     ]
   }
   ```

   - `type: user` = แชทเดี่ยว
   - `type: group` = กลุ่ม

8. คัดลอก `id` ทุกอันที่อยากส่งไปหา เอามาต่อกันด้วยเครื่องหมายจุลภาค **ไม่ต้องเว้นวรรค**

   ```
   U4af4980629...,Ca56a3f7b91...
   ```

9. กลับไป Cloudflare → Worker → Settings → Variables and Secrets → แก้ค่า `LINE_TARGET_IDS` เป็นสตริงข้างบน แล้ว **Deploy**

10. เปิด URL ของ Worker อีกครั้ง คราวนี้ `targetCount` ควรเป็นจำนวนปลายทางที่ใส่ไป

## 2.8 ทดสอบส่งจริง

เอาไฟล์รูป JPEG อะไรก็ได้มาทดสอบ ถ้ามีเครื่องที่รันคำสั่งได้ ลองแบบนี้

```bash
curl -X POST "URL_ของ_Worker/ingest" \
  -H "X-Bot-Secret: INGEST_SECRET_ของคุณ" \
  -F "photo=@รูปทดสอบ.jpg" \
  -F "caption=ทดสอบระบบ"
```

ถ้าไม่สะดวกรันคำสั่ง ให้ข้ามไปทำ [ขั้นที่ 3](03-shortcut-setup.md) เลย แล้วกด Run ใน Shortcut เพื่อทดสอบแทน — ได้ผลเหมือนกัน

---

## สรุปสิ่งที่ต้องมีติดมือไปขั้นต่อไป

- [ ] **URL ของ Worker** เช่น `https://line-photo-bot.arm.workers.dev`
- [ ] **INGEST_SECRET** ที่ตั้งไว้
- [ ] เปิด URL ของ Worker แล้ว `hasAccessToken`, `hasIngestSecret` เป็น `true` และ `targetCount` มากกว่า 0
