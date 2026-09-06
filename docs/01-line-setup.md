# ขั้นที่ 1 — สร้าง LINE Official Account และเอา token

ใช้เวลาประมาณ 15 นาที ทำบนคอมพิวเตอร์จะสะดวกกว่ามือถือ

## 1.1 สร้าง Provider และ Channel

1. เข้า https://developers.line.biz/console/ แล้วล็อกอินด้วยบัญชี LINE ที่ใช้อยู่
2. กด **Create a new provider** — ตั้งชื่ออะไรก็ได้ เช่น `Arm Family` (ชื่อนี้ผู้รับไม่เห็น)
3. ในหน้า provider ที่เพิ่งสร้าง กด **Create a Messaging API channel**
   - ถ้าระบบพาไปหน้า LINE Official Account Manager ให้สร้างบัญชีที่นั่นก่อน แล้วค่อยกลับมา ระบบจะเชื่อมให้เอง
4. กรอกข้อมูล
   - **Channel name** — ชื่อที่จะโผล่ในแชท เช่น `ความทรงจำของลูก`
   - **Channel description** — เช่น `ส่งรูปความทรงจำให้ครอบครัว`
   - **Category / Subcategory** — เลือกอะไรก็ได้ที่ใกล้เคียง เช่น Personal
   - อีเมล ใส่อีเมลตัวเอง
5. ติ๊กยอมรับเงื่อนไข แล้วกด **Create**

## 1.2 เอา Channel access token

1. เข้า channel ที่เพิ่งสร้าง → แท็บ **Messaging API**
2. เลื่อนลงล่างสุด หัวข้อ **Channel access token (long-lived)** กด **Issue**
3. จะได้สตริงยาวมาก **คัดลอกเก็บไว้** — นี่คือ `LINE_CHANNEL_ACCESS_TOKEN`

> ⚠️ token นี้คือกุญแจของบัญชี ใครได้ไปส่งข้อความในนามเราได้หมด **ห้ามแปะลงในโค้ดหรือ commit ขึ้น GitHub เด็ดขาด** เดี๋ยวขั้นที่ 2 จะสอนวิธีเก็บให้ปลอดภัย

## 1.3 เอา Channel secret

1. ยังอยู่ใน channel เดิม → แท็บ **Basic settings**
2. หา **Channel secret** กด **Show** แล้วคัดลอกเก็บไว้ — นี่คือ `LINE_CHANNEL_SECRET`
3. อันนี้ใช้ตรวจว่า webhook ที่ส่งมาเป็นของ LINE จริง ไม่ใช่คนอื่นปลอมมา

## 1.4 ปิดข้อความตอบกลับอัตโนมัติ

ไม่งั้นบอทจะตอบข้อความมั่ว ๆ ทุกครั้งที่มีคนพิมพ์ในแชท

1. แท็บ **Messaging API** → หัวข้อ **LINE Official Account features**
2. กดลิงก์ **Edit** ข้าง Auto-reply messages (จะเด้งไป LINE Official Account Manager)
3. ตั้งค่าเป็น
   - **Greeting messages** — ปิด (Disabled)
   - **Auto-response messages** — ปิด (Disabled)
   - **Webhooks** — เปิด (Enabled)

## 1.5 เพิ่มบอทเป็นเพื่อน และเชิญเข้ากลุ่ม

1. กลับไปแท็บ **Messaging API** จะเห็น **QR code** ของบัญชี
2. **ทุกคนที่จะรับรูป** ต้องสแกน QR นี้แล้วกด **เพิ่มเพื่อน** — ถ้าไม่กด บอทส่งหาไม่ได้เลย
3. สำหรับ **กลุ่ม LINE** — เปิดกลุ่มนั้น → เชิญเพื่อน → ค้นหาชื่อบัญชีบอท → เชิญเข้ากลุ่ม

> บัญชีทางการต้องเปิดให้เข้ากลุ่มได้ก่อน: ใน LINE Official Account Manager → Settings → Account settings → **Allow the Official Account to join group chats** ต้องเปิดไว้

## 1.6 หา LINE id ของปลายทาง

ตรงนี้จะทำหลังจาก deploy Worker เสร็จแล้วในขั้นที่ 2 เพราะต้องใช้ URL ของ Worker
บันทึกไว้ก่อนว่า **ยังต้องกลับมาทำข้อนี้** แล้วไปทำ [ขั้นที่ 2](02-cloudflare-setup.md) ต่อ

---

## สรุปสิ่งที่ต้องมีติดมือไปขั้นต่อไป

- [ ] `LINE_CHANNEL_ACCESS_TOKEN` — สตริงยาวมาก
- [ ] `LINE_CHANNEL_SECRET` — สตริงสั้นกว่า
- [ ] ทุกคนที่จะรับรูป กด "เพิ่มเพื่อน" บัญชีบอทแล้ว
- [ ] เชิญบอทเข้ากลุ่ม LINE ที่ต้องการแล้ว
