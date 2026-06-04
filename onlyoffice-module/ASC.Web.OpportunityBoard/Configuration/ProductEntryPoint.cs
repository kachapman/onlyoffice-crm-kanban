/*
 * CRM Opportunity Kanban — OnlyOffice Workspace custom module
 */

using System;
using System.Linq;

using ASC.Core;
using ASC.Web.Core;
using ASC.Web.Core.Utility;
using ASC.Web.OpportunityBoard.Masters.ClientScripts;
using ASC.Web.OpportunityBoard.Resources;
using ASC.Web.Studio.Utility;

namespace ASC.Web.OpportunityBoard.Configuration
{
    public class ProductEntryPoint : Product
    {
        public static readonly Guid Id = new Guid("{7C4E9A2B-1D3F-4E8A-9B2C-5D6F7A8B9C0D}");

        private ProductContext context;

        public override Guid ProductID => Id;

        public override string Name => OpportunityBoardResource.ProductName;

        public override string Description
        {
            get
            {
                var id = SecurityContext.CurrentAccount.ID;
                if (CoreContext.UserManager.IsUserInGroup(id, ASC.Core.Users.Constants.GroupAdmin.ID)
                    || CoreContext.UserManager.IsUserInGroup(id, Id))
                    return OpportunityBoardResource.ExtendedProductDescription;
                return OpportunityBoardResource.ProductDescription;
            }
        }

        public override string StartURL => PathProvider.BaseVirtualPath;

        public override string HelpURL => StartURL;

        public override string ProductClassName => "opportunityboard";

        public override bool Visible => !TenantExtra.Saas && !CoreContext.Configuration.CustomMode;

        public override ProductContext Context => context;

        public override void Init()
        {
            context = new ProductContext
            {
                MasterPageFile = PathProvider.BaseVirtualPath + "Masters/BasicTemplate.Master",
                DisabledIconFileName = "product_logo_disabled.png",
                IconFileName = "product_logo.png",
                LargeIconFileName = "product_logo_large.svg",
                LargeIconFileNameDark = "product_logo_large_dark.svg",
                DefaultSortOrder = 95,
                SubscriptionManager = null,
                SpaceUsageStatManager = null,
                AdminOpportunities = () => OpportunityBoardResource.ProductAdminOpportunities.Split('|').ToList(),
                UserOpportunities = () => OpportunityBoardResource.ProductUserOpportunities.Split('|').ToList(),
            };

            SearchHandlerManager.Registry(new OpportunityBoardSearchHandler());
            ClientScriptLocalization = new ClientLocalizationResources();
        }
    }
}