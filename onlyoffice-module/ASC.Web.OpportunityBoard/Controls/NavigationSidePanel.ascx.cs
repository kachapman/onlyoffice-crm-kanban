using System;
using System.IO;
using System.Web;
using System.Web.UI;

using ASC.Web.OpportunityBoard.Classes;

namespace ASC.Web.OpportunityBoard.Controls
{
    public partial class NavigationSidePanel : UserControl
    {
        public static string Location => PathProvider.GetFileStaticRelativePath("NavigationSidePanel.ascx");
        protected string CurrentPage { get; set; }

        protected void Page_Load(object sender, EventArgs e)
        {
            var page = HttpContext.Current.Request.CurrentExecutionFilePath;
            if (!string.IsNullOrEmpty(page))
                page = Path.GetFileNameWithoutExtension(page);
            CurrentPage = (page ?? "default").ToLowerInvariant();
        }
    }
}