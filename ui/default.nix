{ pkgs ? import
    (fetchTarball {
      name = "jpetrucciani-2026-07-21";
      url = "https://github.com/jpetrucciani/nix/archive/31fe870656eadb142fd1cb18f9d1a2100c1ffe32.tar.gz";
      sha256 = "1k6biif8rcwdn9yqgdlqzp62r5ly5l30sp006gjhcywlq6nzkj49";
    })
    { }

}:
let
  name = "ge-dashboard-ui";

  tools = with pkgs; {
    cli = [
      jfmt
      nixup
    ];
    bun = [ bun nodejs ];
    scripts = pkgs.lib.attrsets.attrValues scripts;
  };

  scripts = with pkgs; {
    dev = pog {
      name = "dev";
      description = "start the vite dev server";
      script = ''
        if [ ! -d node_modules ]; then
          echo "→ Installing dependencies..."
          bun install
        fi
        bun run dev
      '';
    };

    build = pog {
      name = "build";
      description = "typecheck and build to ./dist";
      script = ''
        if [ ! -d node_modules ]; then
          echo "→ Installing dependencies..."
          bun install
        fi
        bun run build
        echo ""
        echo "✅ Build complete: ./dist"
      '';
    };

    preview = pog {
      name = "preview";
      description = "preview the production build";
      script = ''
        if [ ! -d dist ]; then
          echo "→ No dist/ found. Running build first..."
          ${scripts.build}/bin/build
        fi
        bun run preview
      '';
    };

    check = pog {
      name = "check";
      description = "typecheck only (vue-tsc)";
      script = ''
        if [ ! -d node_modules ]; then
          echo "→ Installing dependencies..."
          bun install
        fi
        bun run typecheck
      '';
    };

    ui-update = pog {
      name = "ui-update";
      description = "pull the latest shared styles/components (@fisherrjd/ui) and typecheck";
      script = ''
        cd "$(git rev-parse --show-toplevel)/ui" || exit 1
        # bun.lock pins the ui commit as github:fisherrjd/ui#<sha>
        rev() { grep -oE 'github:fisherrjd/ui#[0-9a-f]+' bun.lock | head -1 | cut -d'#' -f2; }
        before=$(rev)
        bun update @fisherrjd/ui
        after=$(rev)
        if [ "$before" = "$after" ]; then
          echo "✓ already on the latest @fisherrjd/ui ($after)"
          exit 0
        fi
        echo "→ @fisherrjd/ui $before → $after"
        echo "  https://github.com/fisherrjd/ui/compare/$before...$after"
        bun run typecheck
        echo ""
        echo "✅ updated — eyeball /styleguide (dev), then commit ui/bun.lock"
      '';
    };
  };
  paths = pkgs.lib.flatten [ (builtins.attrValues tools) ];
  env = pkgs.buildEnv {
    inherit name paths; buildInputs = paths;
  };
in
(env.overrideAttrs (_: {
  inherit name;
  NIXUP = "0.0.11";
})) // { inherit scripts; }
