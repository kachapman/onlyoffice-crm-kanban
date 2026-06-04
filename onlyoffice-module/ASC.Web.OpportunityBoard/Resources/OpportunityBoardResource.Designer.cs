namespace ASC.Web.OpportunityBoard.Resources
{
    using System;

    [global::System.CodeDom.Compiler.GeneratedCodeAttribute("System.Resources.Tools.StronglyTypedResourceBuilder", "4.0.0.0")]
    [global::System.Diagnostics.DebuggerNonUserCodeAttribute()]
    [global::System.Runtime.CompilerServices.CompilerGeneratedAttribute()]
    public class OpportunityBoardResource
    {
        private static global::System.Resources.ResourceManager resourceMan;
        private static global::System.Globalization.CultureInfo resourceCulture;

        internal OpportunityBoardResource() { }

        public static global::System.Resources.ResourceManager ResourceManager
        {
            get
            {
                if (object.ReferenceEquals(resourceMan, null))
                    resourceMan = new global::System.Resources.ResourceManager("ASC.Web.OpportunityBoard.Resources.OpportunityBoardResource", typeof(OpportunityBoardResource).Assembly);
                return resourceMan;
            }
        }

        public static global::System.Globalization.CultureInfo Culture
        {
            get => resourceCulture;
            set => resourceCulture = value;
        }

        public static string ProductName => ResourceManager.GetString("ProductName", resourceCulture);
        public static string ProductDescription => ResourceManager.GetString("ProductDescription", resourceCulture);
        public static string ExtendedProductDescription => ResourceManager.GetString("ExtendedProductDescription", resourceCulture);
        public static string ProductAdminOpportunities => ResourceManager.GetString("ProductAdminOpportunities", resourceCulture);
        public static string ProductUserOpportunities => ResourceManager.GetString("ProductUserOpportunities", resourceCulture);
        public static string Search => ResourceManager.GetString("Search", resourceCulture);
        public static string BoardTitle => ResourceManager.GetString("BoardTitle", resourceCulture);
        public static string BoardDescription => ResourceManager.GetString("BoardDescription", resourceCulture);
        public static string Refresh => ResourceManager.GetString("Refresh", resourceCulture);
        public static string OpenCrm => ResourceManager.GetString("OpenCrm", resourceCulture);
        public static string SearchLabel => ResourceManager.GetString("SearchLabel", resourceCulture);
        public static string GroupBy => ResourceManager.GetString("GroupBy", resourceCulture);
        public static string GroupStage => ResourceManager.GetString("GroupStage", resourceCulture);
        public static string GroupResponsible => ResourceManager.GetString("GroupResponsible", resourceCulture);
        public static string GroupOutcome => ResourceManager.GetString("GroupOutcome", resourceCulture);
        public static string StageType => ResourceManager.GetString("StageType", resourceCulture);
        public static string All => ResourceManager.GetString("All", resourceCulture);
        public static string OpenOnly => ResourceManager.GetString("OpenOnly", resourceCulture);
        public static string ClosedWon => ResourceManager.GetString("ClosedWon", resourceCulture);
        public static string ClosedLost => ResourceManager.GetString("ClosedLost", resourceCulture);
        public static string Stage => ResourceManager.GetString("Stage", resourceCulture);
        public static string AllStages => ResourceManager.GetString("AllStages", resourceCulture);
        public static string Tags => ResourceManager.GetString("Tags", resourceCulture);
        public static string TagsHint => ResourceManager.GetString("TagsHint", resourceCulture);
        public static string ContactId => ResourceManager.GetString("ContactId", resourceCulture);
        public static string FromDate => ResourceManager.GetString("FromDate", resourceCulture);
        public static string ToDate => ResourceManager.GetString("ToDate", resourceCulture);
        public static string Loading => ResourceManager.GetString("Loading", resourceCulture);
    }
}