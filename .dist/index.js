"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("@atproto/api");
const atproto_firehose_1 = require("atproto-firehose");
const node_html_to_image_1 = __importDefault(require("node-html-to-image"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.configDotenv();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const agent = new api_1.AtpAgent({
            service: "https://bsky.social",
        });
        if (!process.env.BSKY_IDENTIFIER || !process.env.BSKY_PASSWORD) {
            throw new Error("BSKY_IDENTIFIER and BSKY_PASSWORD must be set");
        }
        yield agent.login({
            identifier: process.env.BSKY_IDENTIFIER,
            password: process.env.BSKY_PASSWORD,
        });
        const client = (0, atproto_firehose_1.subscribeRepos)(`wss://bsky.network`, { decodeRepoOps: true });
        client.on("message", (m) => __awaiter(this, void 0, void 0, function* () {
            if (atproto_firehose_1.ComAtprotoSyncSubscribeRepos.isCommit(m)) {
                m.ops.forEach((op) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    try {
                        if (((_a = op.payload) === null || _a === void 0 ? void 0 : _a.$type) !== "app.bsky.feed.post")
                            return;
                        if (!((_b = op.payload) === null || _b === void 0 ? void 0 : _b.reply))
                            return;
                        if (!op.payload.text
                            .toLowerCase()
                            .includes(`@${process.env.BSKY_USERNAME}`))
                            return;
                        const { data: { posts }, } = yield agent.getPosts({
                            uris: [op.payload.reply.parent.uri],
                        });
                        const parentPost = posts[0];
                        const authorPfp = parentPost.author.avatar;
                        const authorUsername = parentPost.author.handle.replace(".bsky.social", "");
                        const textToQuote = parentPost.record.text;
                        const image = yield (0, node_html_to_image_1.default)({
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
                        const b = yield agent.uploadBlob(image);
                        yield agent.post({
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
                    }
                    catch (err) {
                        console.error(err);
                    }
                }));
            }
        }));
    });
}
main();
