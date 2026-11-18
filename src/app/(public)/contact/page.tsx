import type { Metadata } from "next";
import Image from "next/image";
import { Clock, Headset, Mail, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactForm } from "@/features/contact/components/contact-form";
import contactSupport from "../../../../public/images/pages/contact-support.webp";

export const metadata: Metadata = {
  title: "تماس با ما",
  description: "پرسش، پیشنهاد یا گزارش مشکل خود را برای پشتیبانی سروینو بفرستید.",
};

const INFO = [
  { icon: Headset, title: "پشتیبانی کاربران", text: "کاربران واردشده می‌توانند از بخش «پشتیبانی» داشبورد تیکت ثبت کنند." },
  { icon: Clock, title: "ساعات پاسخ‌گویی", text: "شنبه تا پنجشنبه، ۹ تا ۱۸" },
  { icon: Mail, title: "پاسخ به پیام‌ها", text: "پاسخ از طریق شماره موبایل یا ایمیلی که وارد می‌کنید ارسال می‌شود." },
  { icon: MapPin, title: "محدوده خدمات", text: "شهرهای فعال در بخش خدمات و فرم ثبت درخواست قابل مشاهده‌اند." },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 lg:py-14">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-extrabold">تماس با ما</h1>
        <p className="leading-8 text-muted-foreground">پرسش، پیشنهاد یا گزارش مشکل خود را بنویسید؛ پیام شما مستقیماً به صندوق پیام مدیریت سروینو می‌رسد.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>ارسال پیام</CardTitle>
            <CardDescription>فیلدهای ستاره‌دار الزامی‌اند. شماره موبایل یا ایمیل را برای دریافت پاسخ وارد کنید.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContactForm />
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Image
            src={contactSupport}
            alt="کارشناس پشتیبانی سروینو در حال پاسخ‌گویی"
            placeholder="blur"
            sizes="(min-width: 1024px) 440px, 100vw"
            className="aspect-[4/3] w-full rounded-3xl object-cover shadow-soft"
          />
          <ul className="space-y-4">
            {INFO.map((i) => (
              <li key={i.title} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <i.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{i.title}</p>
                  <p className="text-sm leading-7 text-muted-foreground">{i.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
