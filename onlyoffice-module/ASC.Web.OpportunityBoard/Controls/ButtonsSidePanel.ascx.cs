using System;
using System.Web.UI;

using ASC.Web.OpportunityBoard.Classes;

namespace ASC.Web.OpportunityBoard.Controls
{
    public partial class ButtonsSidePanel : UserControl
    {
        public static string Location => PathProvider.GetFileStaticRelativePath("ButtonsSidePanel.ascx");
        protected void Page_Load(object sender, EventArgs e) { }
    }
}