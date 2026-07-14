# 日本語フォントの配置について

PDF生成(`app/api/invoices/[invoiceId]/pdf/route.ts`)では、
日本語を描画するために `NotoSansJP-Regular.ttf` をこのフォルダに
配置する必要があります。

`pdf-lib`の標準フォントは日本語(漢字・ひらがな・カタカナ)に
対応していないため、日本語対応のTTFフォントを別途埋め込む必要が
あります。フォントファイルはライセンスの関係上、このリポジトリには
同梱していません。

## 入手方法

1. Google Fonts の Noto Sans JP をダウンロードしてください。
   https://fonts.google.com/noto/specimen/Noto+Sans+JP
2. ダウンロードしたファイルを `NotoSansJP-Regular.ttf` という
   ファイル名にリネームし、このフォルダ(`public/fonts/`)に配置してください。

Noto Sans JP は SIL Open Font License 1.1 で提供されており、
商用利用を含め無償で利用できます。

## 配置後の確認

```
public/fonts/NotoSansJP-Regular.ttf
```

このパスにファイルが存在しない場合、PDF生成時に
「日本語フォントファイルが見つかりません」というエラーが返ります。
