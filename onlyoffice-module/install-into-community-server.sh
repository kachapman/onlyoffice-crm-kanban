#!/usr/bin/env bash
# Copy Opportunity Board module into a local Community Server checkout.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_SRC="${SCRIPT_DIR}/ASC.Web.OpportunityBoard"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/CommunityServer"
  echo "Example: $0 ~/CommunityServer"
  exit 1
fi

CS_ROOT="$(cd "$1" && pwd)"
DEST="${CS_ROOT}/web/studio/ASC.Web.Studio/Products/OpportunityBoard"
BUILD_PROJ="${CS_ROOT}/build/msbuild/build.proj"

if [[ ! -d "${CS_ROOT}/web/studio/ASC.Web.Studio/Products" ]]; then
  echo "Error: ${CS_ROOT} does not look like Community Server (missing Products folder)."
  exit 1
fi

echo "Installing module to ${DEST}"
rm -rf "${DEST}"
cp -a "${MODULE_SRC}" "${DEST}"

SNIPPET='    <ProjectToBuild Include="$(ASCDir)web\studio\ASC.Web.Studio\Products\OpportunityBoard\ASC.Web.OpportunityBoard.csproj"/>'

if [[ -f "${BUILD_PROJ}" ]] && ! grep -q "OpportunityBoard" "${BUILD_PROJ}"; then
  echo "Adding build.proj entry (after Sample if present)..."
  if grep -q 'Products\\Sample\\ASC.Web.Sample.csproj' "${BUILD_PROJ}"; then
    sed -i '/Products\\Sample\\ASC.Web.Sample.csproj/a\'"${SNIPPET}" "${BUILD_PROJ}"
  else
    echo "${SNIPPET}" >> "${BUILD_PROJ}"
  fi
  echo "Updated ${BUILD_PROJ}"
else
  echo "build.proj already contains OpportunityBoard or file missing — skip."
fi

echo ""
echo "Done. Next on Windows:"
echo "  1. Run build/Build.bat"
echo "  2. Enable 'Opportunity Board' under Modules & Tools"
echo "  3. Visit /Products/OpportunityBoard/Default.aspx"
echo ""
echo "See INSTALL.txt for full details."