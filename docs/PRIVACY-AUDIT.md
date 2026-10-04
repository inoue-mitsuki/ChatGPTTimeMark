# プライバシー確認記録

対象：0.1.15、確認日2026-10-04。

| 対象 | 確認内容・根拠 | 結果 |
|---|---|---|
| core.js | record/extractはuserのidとcreate_timeのみ返却、本文を返さない | コード・自動テスト確認 |
| interceptor.js | originalFetchを1回呼び、元Promiseを返す。対象応答をcloneして読む。診断は固定API種別と件数のみ | コード・自動テスト確認 |
| content.js | 同一source/origin/route、ID・日時の検証。DOM受渡しはID・日時・会話パス | コード・簡易DOMテスト確認 |
| 保存 | localStorage/sessionStorage/IndexedDB/chrome.storageの処理なし | 配布コード検索・照合 |
| 外部送信 | 追加fetch、XHR、WebSocket、sendBeacon、外部SDK、分析なし | 配布コード検索・照合 |
| リモート実行 | 同梱スクリプトのみ、eval/new Function/外部importなし | 配布コード検索・照合 |
| manifest | chatgpt.com限定・all_frames、API権限・追加host権限なし | manifest確認 |

DOMの情報はページ内スクリプトや他の拡張から参照可能。参照元は本文を含む場合があるため「本文に一切アクセスしない」とは説明しない。

全通信・ストレージの実機監査は未実施。現在のブラウザ操作ツールは完全なネットワーク／保存の監査ログを提供せず、最新版の読み込みも未確認。最新コードとポリシーの照合は完了したが、全実機監査が完了したとは扱わない。ユーザー依頼から動作確認作業1を除外したまま、未確認事項を残す。
ポリシー公開URLは2026-10-04に未ログインで本文の到達性を確認済み。
