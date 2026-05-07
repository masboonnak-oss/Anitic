{pkgs}: {
  deps = [
    pkgs.alsa-lib
    pkgs.xorg.libXrandr
    pkgs.xorg.libXScrnSaver
    pkgs.xorg.libxcb
    pkgs.xorg.libXtst
    pkgs.xorg.libXi
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcursor
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.nss
    pkgs.chromium
  ];
}
