using System;
using System.Web.UI;

using ASC.Web.Core;
using ASC.Web.Core.Client.Bundling;
using ASC.Web.Core.Utility;
using ASC.Web.OpportunityBoard.Classes;
using ASC.Web.OpportunityBoard.Configuration;
using ASC.Web.OpportunityBoard.Controls;

namespace ASC.Web.OpportunityBoard.Masters
{
    public partial class BasicTemplate : MasterPage, IStaticBundle
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            CreateButtonContent.Controls.Add(LoadControl(ButtonsSidePanel.Location));
            SideNavigation.Controls.Add(LoadControl(NavigationSidePanel.Location));
            Page.EnableViewState = false;
            Master.AddClientScript(((Product)WebItemManager.Instance[ProductEntryPoint.Id]).ClientScriptLocalization);
        }

        public ScriptBundleData GetStaticJavaScript()
        {
            return new ScriptBundleData("opportunityboard", "opportunityboard")
                .AddSource(PathProvider.GetFileStaticRelativePath, "kanban.js");
        }

        public StyleBundleData GetStaticStyleSheet()
        {
            return new StyleBundleData("opportunityboard", "opportunityboard")
                .AddSource(PathProvider.GetFileStaticRelativePath, "kanban.css");
        }

        public StyleBundleData GetStaticDarkStyleSheet()
        {
            return GetStaticStyleSheet();
        }
    }
}