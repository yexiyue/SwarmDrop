import { i18n } from "@lingui/core";

export const locales = {
  zh: "中文",
  en: "English",
};

export type LocaleKey = keyof typeof locales;

export const defaultLocale: LocaleKey = "zh";

/**
 * 动态加载并激活指定语言的消息目录
 * Vite 插件会自动编译 .po 文件
 */
export async function dynamicActivate(locale: LocaleKey) {
  const { messages } = await import(`../locales/${locale}/messages.po`);
  i18n.load(locale, messages);
  i18n.activate(locale);
}
