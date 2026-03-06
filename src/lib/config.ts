export const APP_CONFIG = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "篮球训练班管理",
  className: process.env.NEXT_PUBLIC_CLASS_NAME || "篮球训练班",
  classNameBm:
    process.env.NEXT_PUBLIC_CLASS_NAME_BM || "Kelas Bola Keranjang",
  schoolName:
    process.env.NEXT_PUBLIC_SCHOOL_NAME || "都九政府小学 SJK Tukau, Miri",
  schoolAddress: process.env.NEXT_PUBLIC_SCHOOL_ADDRESS || "",
  schoolPhone: process.env.NEXT_PUBLIC_SCHOOL_PHONE || "",
  feePerSession: Number(process.env.NEXT_PUBLIC_FEE_PER_SESSION) || 5,
  receiptPrefix: process.env.NEXT_PUBLIC_RECEIPT_PREFIX || "RCPT",
  currency: process.env.NEXT_PUBLIC_CURRENCY || "RM",
  creditNotePrefix: process.env.NEXT_PUBLIC_CREDIT_NOTE_PREFIX || "RTRN",
};
