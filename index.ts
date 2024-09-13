import { AtpAgent } from "@atproto/api";
import {
  ComAtprotoSyncSubscribeRepos,
  SubscribeReposMessage,
  subscribeRepos,
} from "atproto-firehose";
import nodeHtmlToImage from "node-html-to-image";
import dotenv from "dotenv";
dotenv.configDotenv();

interface Op {
  action: "create" | "update" | "delete" | (string & {});
  path: string;
  cid: any | null;
  [k: string]: any;
}

async function main() {
  const agent = new AtpAgent({
    service: "https://bsky.social",
  });

  if (!process.env.BSKY_IDENTIFIER || !process.env.BSKY_PASSWORD) {
    throw new Error("BSKY_IDENTIFIER and BSKY_PASSWORD must be set");
  }

  await agent.login({
    identifier: process.env.BSKY_IDENTIFIER,
    password: process.env.BSKY_PASSWORD,
  });

  const client = subscribeRepos(`wss://bsky.network`, { decodeRepoOps: true });
  client.on("message", async (m: SubscribeReposMessage) => {
    if (ComAtprotoSyncSubscribeRepos.isCommit(m)) {
      m.ops.forEach(async (op: Op) => {
        try {
          if (op.payload?.$type !== "app.bsky.feed.post") return;
          if (!op.payload?.reply) return;
          if (
            !(op.payload.text as string)
              .toLowerCase()
              .includes(`@${process.env.BSKY_USERNAME}`)
          )
            return;

          const {
            data: { posts },
          } = await agent.getPosts({
            uris: [op.payload.reply.parent.uri],
          });
          const parentPost = posts[0];
          const authorPfp = parentPost.author.avatar;
          const authorUsername = parentPost.author.handle.replace(
            ".bsky.social",
            "",
          );
          const textToQuote = (parentPost.record as any).text;

          const image = await nodeHtmlToImage({
            html: `
            <html>
              <body
              style="
                width: 1200px;
                height: 630px;
                background-color: #000;
                display: flex;
                gap: 32px;
                align-items:center;
              position:relative
              "
            >
              <img
                src="${authorPfp}"
                style="filter: grayscale(100%);height:100%;width:auto;position:absolute;left:-10%"
              />
              <div style="position:absolute;width:100px;height:100%;right:700px;background-image:linear-gradient(to left, #000, #000, rgba(0,0,0,0));" ></div>

              <div
                style="
                background-color:#000;
                z-index:100;
                  max-width: 700px;
                  min-width: 700px;
                height:100%;
                  display: flex;
                  flex-direction: column;
                  gap: 20px;
                  font-family: Arial;
                  color: #fff;
                align-items:center;
                justify-content:center;
                text-align:center;
                position:absolute;
                right:16px
                "
              >
                <p style="margin:0;font-size:40px">
                  ${textToQuote}
                </p>
                <i style="font-size:18px">-${authorUsername}</i>
              </div>
            </body>
          </html>
        `,
          });

          const b = await agent.uploadBlob(image as Buffer);

          await agent.post({
            text: "",
            embed: {
              $type: "app.bsky.embed.images",
              images: [
                {
                  image: b.data.blob,
                  alt: `Uma citação de ${authorUsername}: "${textToQuote}"`,
                },
              ],
            },
            reply: {
              root: op.payload.reply.root,
              parent: {
                cid: op.cid.toString(),
                uri: `at://${m.repo}/${op.path}`,
              },
            },
          });

          console.log("posted");
        } catch (err: any) {
          console.error(err);
        }
      });
    }
  });
}

main();
