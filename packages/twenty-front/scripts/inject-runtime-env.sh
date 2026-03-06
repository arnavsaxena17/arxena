#!/bin/sh

echo "Injecting runtime environment variables into index.html..."

CONFIG_BLOCK=$(cat << EOF
    <script id="arxena-env-config">
      window._env_ = {
        REACT_APP_SERVER_BASE_URL: "$REACT_APP_SERVER_BASE_URL"
      };
    </script>
    <!-- END: ARxena Config -->
EOF
)
# Use sed to replace the config block in index.html
# Using pattern space to match across multiple lines
echo "$CONFIG_BLOCK" | sed -i.bak '
  /<!-- BEGIN: Arxena Config -->/,/<!-- END: Arxena Config -->/{
    /<!-- BEGIN: Arxena Config -->/!{
      /<!-- END: TweArxenanty Config -->/!d
    }
    /<!-- BEGIN: Arxena Config -->/r /dev/stdin
    /<!-- END: Arxena Config -->/d
  }
' build/index.html
rm -f build/index.html.bak
