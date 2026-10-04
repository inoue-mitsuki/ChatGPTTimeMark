# ChatGPTTimeMark

ChatGPTのユーザーメッセージの作成日時を、端末の現地時間で秒まで表示するManifest V3拡張です。OpenAIの公式製品ではありません。

表示形式：`YYYY/MM/DD HH:mm:ss`。編集済み投稿では表示中の版の作成日時を、ラベルなしで1件表示します。日時を取得できない投稿には表示しません。

## 利用方法

1. Braveの `brave://extensions`（Chromeでは `chrome://extensions`）を開く。
2. デベロッパーモードを有効にする。
3. このmanifest.jsonのあるフォルダーを「パッケージ化されていない拡張機能を読み込む」で選ぶ。
4. 拡張とChatGPTページを再読み込みする。マルチViewでは各ペインを更新する。

[配布用ZIP](Release/0.1.15/ChatGPTTimeMark-0.1.15.zip)は別フォルダーへ展開してから読み込みます。ストアでの配布・審査申請はまだ行っていません。

## 対応範囲と制限

- 対象はhttps://chatgpt.com/*。通常画面とChatGPTを読み込むiframeに対応。
- 日時はChatGPTのメッセージデータから取得。端末の現在時刻から推測しません。
- ChatGPTの内部データや画面構造が変わると取得できなくなる可能性があります。
- 履歴・本文の永続保存、初回と編集の日時併記、設定画面はありません。
- Chrome・Brave向けです。実機確認はユーザー指定によりBraveのみ。

## 開発

外部の実行依存はありません。Node.js 20以上で実行します。

```sh
node scripts/build.cjs
node --test tests/core.test.cjs
```

SVG素材をPNGへ再生成する開発用スクリプトはsharpを利用します。必要な環境で `CHATGPT_TIMEMARK_SHARP` にsharpのパスを指定して `node scripts/create-store-assets.cjs` を実行してください。生成済みPNGを同梱しているため、利用者には不要です。

## 確認状況

自動テスト14件が成功。Braveの通常画面とマルチView4ペインの表示・更新確認は0.1.11の結果です。最新版0.1.15の読み込み、新規会話の最初の投稿、新たな編集送信、全通信・保存の実機監査は未確認です。静的確認や合成データのテストは実機確認を代替しません。

## プライバシーと関連情報

ChatGPT本来の通信応答とReactデータをブラウザ内で参照します。参照元に本文が含まれ得ますが、本文・認証情報を保存・ログ・表示側転送しません。IDと日時を上限付きメモリに保持し、検証済みID・日時・会話パスをDOMへ付与します。独自の外部通信・永続保存・解析はありません。詳しくは[プライバシーポリシー](PRIVACY.md)を参照してください。

- [リポジトリ](https://github.com/inoue-mitsuki/ChatGPTTimeMark)
- [仕様](SPEC.md)、[開発方針](AGENTS.md)、[確認待ち](QA.md)
- [ストア準備状況](Release/0.1.15/Webストア登録情報/ステータス.md)
- 問い合わせ：inomit3-contact@yahoo.co.jp
- [MIT License](LICENSE)

作業フォルダーは `G:\ドキュメント\chatGPT\ChatGPTTimeMark`。CodexとBraveの参照先を変更した場合は新しい場所から開き直してください。私的な確認画像、旧配布物、詳細な開発履歴は公開Gitの対象外です。
