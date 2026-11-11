FROM busybox:musl

COPY dist/ ./

COPY httpd.conf ./

EXPOSE 3000

CMD ["busybox", "httpd", "-f", "-v", "-p", "3000", "-c", "/httpd.conf", "-h", "/"]
