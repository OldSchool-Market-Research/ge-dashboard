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
