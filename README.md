# برج الشعراوي

مشروع ويب بسيط ومنظم لإدارة الشقق والسكان والخدمات الشهرية والتحصيل والمصروفات والخزنة، مبني بالكامل على:

- `HTML`
- `CSS`
- `JavaScript`
- `Firebase Authentication`
- `Firebase Firestore`

المشروع مناسب للرفع على `GitHub Pages` لأنه لا يعتمد على Backend منفصل.

## المزايا الحالية

- تسجيل دخول عبر Firebase Authentication.
- إنشاء حساب جديد باسم مستخدم ورقم موبايل.
- تفعيل الحسابات الجديدة بعد موافقة الأدمن فقط.
- صلاحيتان فقط: `Admin` و`User`.
- لوحة تحكم عربية `RTL`.
- صفحة `طلبات التسجيل` للأدمن مع قبول أو رفض وربط الحساب بالشقة.
- إدارة الشقق والسكان والخدمات.
- إنشاء خدمات الشهر بدون تكرار لنفس الشقة والشهر والسنة.
- تسجيل دفعات متعددة لنفس السجل عند السداد الجزئي.
- Timeline داخل تفاصيل كل شقة.
- إدارة المصروفات والخزنة.
- إدارة المرفقات عبر `attachmentUrl` مع زر فتح الرابط ومعاينة الصور عند كون الرابط صورة مباشرة.
- بحث سريع عن الشقة أو المالك أو الساكن أو أرقام التواصل.
- سجل تعديلات للأدمن فقط.

## ملاحظة مهمة

هذا المشروع يعمل بدون Backend أو Cloud Functions. لذلك:

- تم تطبيق الصلاحيات في الواجهة وفي Firebase Rules.
- لا يمكن فرض حد "حسابين Admin فقط" بشكل صارم 100% من طرف العميل فقط في Firebase بدون Backend أو Cloud Functions.
- الحل العملي هنا هو إنشاء حسابي الأدمن يدويًا فقط داخل Firebase وعدم إنشاء حسابات Admin إضافية.

## هيكل الملفات

```text
index.html
assets/
  css/styles.css
  js/
    app.js
    firebase-config.js
    firebase-config.example.js
    config/constants.js
    services/
    ui/
    utils/
firebase/
  firestore.rules
README.md
```

## إعداد Firebase

### 1. إنشاء المشروع

أنشئ مشروع Firebase جديدًا، ثم فعّل:

- `Authentication`
- `Firestore Database`

### 2. تفعيل تسجيل الدخول

من قسم `Authentication`:

- فعّل `Email/Password`.

### 3. إنشاء حسابات الدخول

التطبيق يستخدم `Firebase Authentication` بنظام `Email/Password` داخليًا، لكن الواجهة تُظهر للمستخدم:

- `اسم المستخدم`
- `رقم الموبايل`
- `كلمة المرور`

عند إنشاء الحساب:

- يتم إنشاء بريد داخلي تلقائي مثل:

```text
ahmed101@tower.local
```

- ويُستخدم هذا البريد داخليًا مع Firebase Auth.

يمكن للمستخدم بعد ذلك تسجيل الدخول بـ:

1. `اسم المستخدم`
2. أو `رقم الموبايل`
3. أو البريد الإلكتروني مباشرة إذا لزم الأمر

مهم:

- افتراضيًا يستخدم النظام النطاق الداخلي `tower.local`.
- يمكنك تغييره من خلال الخاصية `usernameEmailDomain` داخل [`assets/js/firebase-config.js`](./assets/js/firebase-config.js) إذا رغبت.

### 4. إنشاء وثائق المستخدمين داخل Firestore

بعد إنشاء الحسابات من Authentication، أنشئ وثيقة داخل مجموعة `users` لكل مستخدم، ويكون `document id` هو نفس `uid` الخاص بالمستخدم.

مثال وثيقة أدمن:

```json
{
  "name": "أحمد",
  "email": "admin1@example.com",
  "username": "admin1",
  "phone": "01012345678",
  "role": "admin",
  "status": "active",
  "isActive": true,
  "apartmentId": null,
  "createdAt": "Server Timestamp"
}
```

مثال وثيقة مستخدم جديد قبل المراجعة:

```json
{
  "name": "محمد",
  "email": "mohamed101@tower.local",
  "username": "mohamed101",
  "phone": "01012345678",
  "role": "user",
  "status": "pending",
  "isActive": false,
  "apartmentId": null,
  "createdAt": "Server Timestamp"
}
```

بعد موافقة الأدمن تصبح مثلًا:

```json
{
  "status": "active",
  "isActive": true,
  "apartmentId": "APARTMENT_DOCUMENT_ID"
}
```

### 5. إضافة إعدادات Firebase داخل المشروع

انسخ الملف:

```text
assets/js/firebase-config.example.js
```

ثم ضع بيانات مشروعك داخل:

```text
assets/js/firebase-config.js
```

مثال:

```js
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  usernameEmailDomain: "",
};
```

مهم:

- بيانات Web Config الخاصة بـ Firebase ليست Service Account Secret.
- لا ترفع أي مفاتيح Admin SDK أو ملفات خدمة خاصة.

## تفعيل القواعد

### Firestore Rules

ضع محتوى الملف [`firebase/firestore.rules`](./firebase/firestore.rules) داخل قسم قواعد Firestore.

## طريقة التشغيل محليًا

لا تفتح المشروع عبر `file://` مباشرة. استخدم خادمًا ثابتًا بسيطًا.

إذا كنت تعمل داخل هذا المسار على جهازك، يمكنك استخدام مثلًا:

```bash
php -S localhost:8000
```

ثم افتح:

```text
http://localhost:8000
```

وتأكد من إضافة `localhost` ضمن `Authorized domains` في Firebase Authentication.

## الرفع على GitHub Pages

1. ارفع الملفات إلى GitHub.
2. فعّل `GitHub Pages` من إعدادات المستودع.
3. استخدم فرع `main` أو `gh-pages` حسب إعدادك.
4. أضف دومين GitHub Pages الخاص بك إلى `Authorized domains` في Firebase Authentication.

مثال شائع:

```text
YOUR_USERNAME.github.io
```

إذا كان المشروع داخل مستودع باسم مختلف، قد يصبح الرابط مثل:

```text
https://YOUR_USERNAME.github.io/REPOSITORY_NAME/
```

## المجموعات المستخدمة

```text
users
loginIndex
apartments
residents
services
monthlyCharges
payments
expenses
treasuryTransactions
attachments
activityLogs
settings
```

## ملاحظات تنفيذية

- البيانات الأساسية لا تستخدم `LocalStorage`.
- التخزين الأساسي كله على Firebase.
- تم فصل فهرس دخول محدود داخل مجموعة `loginIndex` حتى يمكن تسجيل الدخول باسم المستخدم أو رقم الهاتف بدون كشف مجموعة `users` كاملة لغير المسجلين.
- المرفقات تعتمد على رابط نصي داخل الحقل `attachmentUrl` بدل رفع الملفات.
- إذا انتهى الرابط بـ `jpg` أو `jpeg` أو `png` أو `webp` فستظهر معاينة مصغرة داخل النظام.
- الشقة المرتبطة بسجلات مالية يتم أرشفتها بدل حذفها نهائيًا من الواجهة.
- حذف المصروف يتم كحذف منطقي `soft delete` مع الاحتفاظ بالسجل المالي.
- الرصيد الحالي في الخزنة يتم احتسابه تلقائيًا:

```text
الرصيد الحالي = الرصيد الافتتاحي + إجمالي المحصل - إجمالي المصروفات
```

## ما الذي قد ترغب بإكماله لاحقًا

- شاشة إدارة المستخدمين من داخل الواجهة.
- تثبيت حسابي الأدمن بشكل أكثر صرامة عبر Cloud Functions أو Backend خفيف.
- إضافة فهارس Firestore إضافية إذا توسعت الاستعلامات مستقبلًا.
