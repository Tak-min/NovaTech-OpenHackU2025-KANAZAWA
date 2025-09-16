# NovaTech-OpenHackU2025-KANAZAWA



# 晴れ/雨男・女判定アプリ 開発セットアップ手順

このドキュメントは、プロジェクトの開発環境をセットアップするための手順書です。
プロジェクトは**Docker**を使用しているため、個人のPC環境を汚さずに誰でも同じ環境を構築できます。

-----

## 1\. 必要なツール

開発を始める前に、お使いのPCに以下のツールがインストールされていることを確認してください。

  * **[Git](https://git-scm.com/)**: ソースコードを管理・取得するために使用します。
  * **[Docker Desktop](https://www.docker.com/products/docker-desktop/)**: プロジェクトのサーバーとデータベースをコンテナとして起動するために必須です。
  * **お好みのコードエディタ** (例: [Visual Studio Code](https://code.visualstudio.com/))

-----

## 2\. セットアップ手順

ターミナル（WindowsならPowerShellやWSL、Macならターミナル）を開き、以下のコマンドを順番に実行してください。

### ステップ1: プロジェクトのクローン

まず、Gitを使ってプロジェクトのソースコードをPCにコピーします。

```bash
# <リポジトリのURL> は実際のURLに置き換えてください
git clone <リポジトリのURL>

# 作成されたプロジェクトフォルダに移動します
cd <プロジェクトのフォルダ名>
```

### ステップ2: `.env` ファイルの作成

プロジェクトのルートフォルダに `.env` という名前のファイルを手動で作成し、以下の内容を貼り付けてください。
このファイルは、データベースのパスワードなど、環境ごとの設定を記述する重要なファイルです。

```env
# データベース接続設定
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=hare_ame_db
DATABASE_URL=postgres://myuser:mypassword@db:5432/hare_ame_db

# JWT（認証）用の秘密鍵
JWT_SECRET=this_is_a_super_secret_key
```

### ステップ3: バックエンド環境の起動

以下のコマンドを実行すると、バックエンドサーバーとデータベースが起動します。

```bash
docker-compose up --build
```

  * `--build` オプションは初回のみ必要です。2回目以降は `docker-compose up` だけでOKです。
  * ターミナルに多くのログが表示され、最後に `Database connection successful!` と表示されれば成功です。
  * このターミナルは**起動したまま**にしておいてください。

### ステップ4: フロントエンドの準備

**別の新しいターミナルを開いて**、以下のコマンドを実行します。

```bash
# frontend フォルダに移動します
cd frontend

# 必要なライブラリをインストールします
npm install
```

-----

## 3\. 実行と動作確認

セットアップが完了したら、実際にアプリを動かしてみましょう。

### ① バックエンドの確認

  * ブラウザで `http://localhost:3000` を開きます。
  * 「`Hello World! DB time is: ...`」といったメッセージが表示されれば、バックエンドは正常に動作しています。

### ② フロントエンドの起動と確認

  * `frontend` フォルダで `npm install` を実行したターミナルで、以下のコマンドを実行します。

    ```bash
    npm run dev
    ```

  * ターミナルに表示されたURL（例: `http://localhost:5173/`）をブラウザで開きます。

  * **ログイン画面が表示されれば、すべての準備は完了です！ :tada:**

-----

## :bulb: 普段の開発フロー

#### 開発を始めるとき

1.  プロジェクトルートで `docker-compose up -d` を実行してバックエンドを起動します。
2.  `frontend` フォルダに移動し `npm run dev` を実行してフロントエンドを起動します。

#### 開発を終えるとき

1.  プロジェクトルートで `docker-compose down` を実行してバックエンドを停止します。
2.  フロントエンドのターミナルで `Ctrl + C` を押して停止します。