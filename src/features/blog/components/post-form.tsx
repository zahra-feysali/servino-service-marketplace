import { Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { MultiFileInput } from "@/components/shared/multi-file-input";
import { FormFieldError, FormUploadProgress, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { BlogCover } from "./blog-ui";
import type { adminGetPost } from "@/features/blog/queries";

type Post = NonNullable<Awaited<ReturnType<typeof adminGetPost>>>;

const GUIDE = "## تیتر اصلی · ### تیتر فرعی · - فهرست · 1. فهرست شماره‌دار · > نقل‌قول · **متن پررنگ** · خط خالی = پاراگراف جدید";

/** Admin create/edit form for blog posts (multipart: optional cover upload). */
export function PostForm({ post, categories }: { post?: Post; categories: { id: string; name: string }[] }) {
  return (
    <ServerForm endpoint={post ? `/api/admin/blog/posts/${post.id}` : "/api/admin/blog/posts"}>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">محتوا</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">عنوان</FieldLabel>
                <Input id="title" name="title" required maxLength={200} defaultValue={post?.title} />
                <FormFieldError name="title" />
              </Field>
              <Field>
                <FieldLabel htmlFor="slug">نامک (آدرس)</FieldLabel>
                <Input id="slug" name="slug" required maxLength={200} dir="ltr" className="text-end" placeholder="home-cleaning-tips" defaultValue={post?.slug} />
                <FieldDescription>آدرس مقاله: /blog/نامک — فقط حروف کوچک انگلیسی، عدد و خط تیره.</FieldDescription>
                <FormFieldError name="slug" />
              </Field>
              <Field>
                <FieldLabel htmlFor="excerpt">خلاصه</FieldLabel>
                <Textarea id="excerpt" name="excerpt" rows={3} required maxLength={500} defaultValue={post?.excerpt} />
                <FormFieldError name="excerpt" />
              </Field>
              <Field>
                <FieldLabel htmlFor="content">متن مقاله</FieldLabel>
                <Textarea id="content" name="content" rows={22} required className="font-[inherit] leading-7" defaultValue={post?.content} />
                <FieldDescription>{GUIDE}</FieldDescription>
                <FormFieldError name="content" />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">انتشار</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="status">وضعیت</FieldLabel>
                  <NativeSelect id="status" name="status" className="w-full" defaultValue={post?.status ?? "DRAFT"}>
                    <NativeSelectOption value="DRAFT">پیش‌نویس</NativeSelectOption>
                    <NativeSelectOption value="PUBLISHED">منتشرشده</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="categoryId">دسته‌بندی</FieldLabel>
                  <NativeSelect id="categoryId" name="categoryId" className="w-full" defaultValue={post?.categoryId ?? ""}>
                    <NativeSelectOption value="">بدون دسته‌بندی</NativeSelectOption>
                    {categories.map((c) => (
                      <NativeSelectOption key={c.id} value={c.id}>
                        {c.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FormFieldError name="categoryId" />
                </Field>
                <FormUploadProgress />
                <SubmitButton className="w-full">
                  <Save />
                  ذخیره
                </SubmitButton>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">تصویر شاخص</CardTitle>
              <CardDescription>JPG، PNG یا WebP تا ۵ مگابایت (نسبت پیشنهادی ۱۶:۹).</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {post && (post.coverImageKey || post.coverImagePath) ? (
                  <>
                    <BlogCover post={post} sizes="320px" className="aspect-[16/9] rounded-xl" />
                    <Field orientation="horizontal">
                      <Checkbox id="removeCover" name="removeCover" />
                      <FieldLabel htmlFor="removeCover" className="font-normal">
                        حذف تصویر فعلی
                      </FieldLabel>
                    </Field>
                  </>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="cover">{post?.coverImageKey || post?.coverImagePath ? "تصویر جدید" : "انتخاب تصویر"}</FieldLabel>
                  <MultiFileInput id="cover" name="cover" rules={{ accept: ["image/jpeg", "image/png", "image/webp"], maxBytes: 5 * 1024 * 1024, maxFiles: 1 }} />
                  <FormFieldError name="cover" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="coverAlt">متن جایگزین تصویر (alt)</FieldLabel>
                  <Input id="coverAlt" name="coverAlt" maxLength={200} defaultValue={post?.coverAlt ?? ""} />
                  <FormFieldError name="coverAlt" />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">سئو</CardTitle>
              <CardDescription>در صورت خالی بودن، عنوان و خلاصه مقاله استفاده می‌شود.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="seoTitle">عنوان سئو (حداکثر ۷۰ نویسه)</FieldLabel>
                  <Input id="seoTitle" name="seoTitle" maxLength={70} defaultValue={post?.seoTitle ?? ""} />
                  <FormFieldError name="seoTitle" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="seoDescription">توضیح متا (حداکثر ۱۶۰ نویسه)</FieldLabel>
                  <Textarea id="seoDescription" name="seoDescription" rows={3} maxLength={160} defaultValue={post?.seoDescription ?? ""} />
                  <FormFieldError name="seoDescription" />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      </div>
    </ServerForm>
  );
}
