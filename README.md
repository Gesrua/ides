# ides

一个简单的图像去重工具

1. 输入若干个目录，程序分别扫描，去重。程序如果不能确定图像是否重复，将会在终端询问。
2. 检测各个目录之间是否有重复图像，程序将询问应保留哪些。

```
Step 1: Input image directories
it will generate data.json in every directory
it will not scan recursively
directory scans will be performed together
? Image directory _test/s1
? Continue Yes
? Image directory _test/s2
? Continue No
Finish adding all directories
Step 2: check duplicate between different directory
? Which to preserve Preserve All
```

## Installation

require `feh`

- compile: `tsc` or `npm run build`
- run: `node dist/index.js` or `npm run start`