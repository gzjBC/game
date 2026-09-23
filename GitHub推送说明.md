# 《High》GitHub 推送说明

> 远程仓库：https://github.com/gzjBC/game.git（origin）
> 本地分支：main（已首次提交，103 文件基线）
> 更新时间：2026-09-23

## 一、推送前置条件：获取 GitHub Token（PAT）

推送需要 GitHub 认证。本项目用 HTTPS + Personal Access Token（PAT）：

1. 打开 https://github.com/settings/tokens （GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)）
2. 点 **Generate new token (classic)**
3. 勾选权限：`repo`（全部打勾，覆盖读写）
4. 有效期建议选 90 天，生成后**立即复制**（只显示一次）
5. 把 Token 发给我（MainAgent）或自己在下文命令中使用

## 二、推送命令

```bash
cd /Users/gjzbc/Desktop/游戏
git push -u origin main
```

- 第一次会提示输入用户名：填 GitHub 用户名 `gzjBC`
- 密码栏：**粘贴 Token（不是 GitHub 登录密码）**
- 已配置 `credential.helper osxkeychain`，输入一次后 macOS 钥匙串会记住，之后不用再输

## 三、日常同步（改完代码后）

```bash
cd /Users/gjzbc/Desktop/游戏/游戏开发组/src && npm run check   # 先验证
cd ../.. && git add -A && git commit -m "改动说明"             # 本地提交
git push                                                        # 推送到 GitHub
```

## 四、GitHub 仓库要求

- 仓库 `gzjBC/game` 需要在 GitHub 上**已存在**（用户已创建）
- 如果 GitHub 上是空仓库（无 README/license），推送 main 直接成功
- 如果仓库已有内容（如自动生成的 README），需要先 `git pull origin main --rebase` 再 push

## 五、作品集展示建议

推上去后可在 GitHub 仓库首页写 README（项目简介 + 截图 + 试玩链接），求职 AI 应用开发 / Agent 后端岗位时作为项目亮点展示。

## 六、注意事项

- Token 属于机密，**不要提交进代码/文档/聊天记录**；泄露立即在 GitHub 吊销
- 不要用 `https://用户名:token@github.com/...` 这种 URL 写进配置文件（明文泄露风险）
- 如果认证报错 `Authentication failed`，多半是 Token 过期或权限不足，重新生成即可
