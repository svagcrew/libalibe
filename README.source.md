Inside your lib packages

```
$ pnpm link -g
```

Inside your app package (without lili)

```
$ pnpm link -g name-of-lib-package-1
$ pnpm link -g name-of-lib-package-2
$ pnpm link -g name-of-lib-package-3
```

Inside your app package (with lili)

```
$ lili
```

And `libalibe.json` in any of parent directories as many levels up as you want will be merged

```
{
  "include": [
    "name-of-lib-package-1",
    "name-of-lib-package-2",
    "name-of-lib-package-3"
  ]
}
```
