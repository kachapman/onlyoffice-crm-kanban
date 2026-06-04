using System.Collections.Generic;
using System.Web;

using ASC.Web.Core.Client.HttpHandlers;
using ASC.Web.OpportunityBoard.Resources;

namespace ASC.Web.OpportunityBoard.Masters.ClientScripts
{
    public class ClientLocalizationResources : ClientScriptLocalization
    {
        protected override string BaseNamespace => "ASC.OpportunityBoard.Resources";

        protected override IEnumerable<KeyValuePair<string, object>> GetClientVariables(HttpContext context)
        {
            return new List<KeyValuePair<string, object>>
            {
                RegisterResourceSet("OpportunityBoardResource", OpportunityBoardResource.ResourceManager)
            };
        }
    }
}