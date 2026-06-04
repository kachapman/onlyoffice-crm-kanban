using System;

using ASC.Web.OpportunityBoard.Resources;
using ASC.Web.Studio;

namespace ASC.Web.OpportunityBoard
{
    public partial class DefaultPage : MainPage
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            Title = OpportunityBoardResource.BoardTitle;
        }
    }
}