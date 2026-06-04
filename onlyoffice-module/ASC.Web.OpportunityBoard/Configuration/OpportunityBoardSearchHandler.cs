using System;

using ASC.Web.Core.ModuleManagement.Common;
using ASC.Web.Core.Utility;
using ASC.Web.Core.Utility.Skins;
using ASC.Web.OpportunityBoard.Classes;
using ASC.Web.OpportunityBoard.Resources;

namespace ASC.Web.OpportunityBoard.Configuration
{
    public class OpportunityBoardSearchHandler : BaseSearchHandlerEx
    {
        public override Guid ProductID => ProductEntryPoint.Id;
        public override Guid ModuleID => ProductID;
        public override ImageOptions Logo => new ImageOptions { ImageFileName = "common_search_icon.svg" };
        public override string SearchName => OpportunityBoardResource.Search;
        public override IItemControl Control => new SearchResultsView();

        public override SearchResultItem[] Search(string searchText)
        {
            return new[]
            {
                new SearchResultItem
                {
                    Name = OpportunityBoardResource.BoardTitle,
                    Description = searchText,
                    URL = PathProvider.BaseAbsolutePath,
                    Date = DateTime.UtcNow
                }
            };
        }
    }
}