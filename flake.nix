{
  description = "Node.js and TypeScript development environment for K!nd4ASSISTANT";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_latest
            nodePackages.typescript
            nodePackages.ts-node
            nodePackages.npm
          ];

          shellHook = ''
            echo "Node.js $(${pkgs.nodejs_latest}/bin/node --version) development environment"
            echo "TypeScript $(${pkgs.nodePackages.typescript}/bin/tsc --version)"
            echo ""
            echo "Available commands:"
            echo "  node - Run Node.js"
            echo "  npm - Node.js package manager"
            echo "  tsc - TypeScript compiler"
            echo "  ts-node - Execute TypeScript files directly"
          '';
        };
      }
    );
}