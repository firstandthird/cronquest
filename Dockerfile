FROM firstandthird/node:8.8-onbuild

ENTRYPOINT ["node", "bin.js", "/recurring.yaml"]
